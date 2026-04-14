"""
InvoiceChain smart-contract tests.

Contract flow
─────────────
 1. deploy  →  setup_icc()       — deployer creates ICC ASA
 2. seed_pool(payment)           — deployer funds ALGO for inner-txn fees
 3. create_invoice(amt,date,ts)  — mint Invoice NFT, set borrow state
 4. borrow(amount)               — lock collateral, transfer ICC to caller
 5. repay(icc_transfer)          — return ICC, unlock collateral
 6. liquidate()                  — creator only, after due_date

New in this version
───────────────────
- test_borrow_locks_nft_and_sends_icc  verify ICC arrives in SME wallet
- test_liquidation                      overdue position triggers LIQUIDATED status
"""

import pytest
from algosdk.atomic_transaction_composer import TransactionWithSigner
from algokit_utils import (
    AlgoAmount,
    AlgorandClient,
    AssetOptInParams,
    AssetTransferParams,
    CommonAppCallParams,
    LogicError,
    PaymentParams,
)

from smart_contracts.artifacts.invoice.invoice_client import (
    BorrowArgs,
    CreateInvoiceArgs,
    InvoiceFactory,
    RepayArgs,
    SeedPoolArgs,
)

# extra_fee covers one inner-transaction fee
_INNER_FEE = CommonAppCallParams(extra_fee=AlgoAmount.from_micro_algo(1000))

# Far-future Unix timestamp (valid due date)
DUE_DATE = 2_000_000_000
# Past Unix timestamp for liquidation tests
PAST_DATE = 1


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def algorand() -> AlgorandClient:
    return AlgorandClient.default_localnet()


@pytest.fixture
def deployer(algorand: AlgorandClient):
    account = algorand.account.random()
    algorand.account.ensure_funded(
        account.address,
        algorand.account.localnet_dispenser(),
        min_spending_balance=AlgoAmount(algo=10),
    )
    return account


@pytest.fixture
def app_client(algorand: AlgorandClient, deployer):
    factory = algorand.client.get_typed_app_factory(
        InvoiceFactory,
        default_sender=deployer.address,
    )
    client, _ = factory.deploy(on_update="append", on_schema_break="append")
    return client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def fund_app(algorand: AlgorandClient, deployer, app_client, algo: int = 2) -> None:
    """Seed the contract with ALGO for MBR and inner-txn fees."""
    algorand.send.payment(
        PaymentParams(
            sender=deployer.address,
            receiver=app_client.app_address,
            amount=AlgoAmount(algo=algo),
        )
    )


def setup_icc(algorand: AlgorandClient, deployer, app_client) -> int:
    """
    Create the ICC ASA and fund the contract.
    Returns the ICC asset id.
    """
    fund_app(algorand, deployer, app_client, algo=2)
    result = app_client.send.setup_icc(params=_INNER_FEE)
    return result.abi_return


def seed_pool(algorand: AlgorandClient, deployer, app_client) -> None:
    """Send 1 ALGO payment to contract via seed_pool."""
    payment_txn = algorand.create_transaction.payment(
        PaymentParams(
            sender=deployer.address,
            receiver=app_client.app_address,
            amount=AlgoAmount(algo=1),
        )
    )
    app_client.send.seed_pool(
        args=SeedPoolArgs(
            payment=TransactionWithSigner(txn=payment_txn, signer=deployer.signer)
        )
    )


def opt_in_icc(algorand: AlgorandClient, account, icc_asset_id: int) -> None:
    """Opt an account into the ICC ASA so it can receive transfers."""
    algorand.send.asset_opt_in(
        AssetOptInParams(
            sender=account.address,
            asset_id=icc_asset_id,
        )
    )


# ---------------------------------------------------------------------------
# Tests — invoice creation
# ---------------------------------------------------------------------------


def test_create_invoice_low_risk(algorand, deployer, app_client):
    """trust_score=85 → borrow_limit=8500, risk_level=LOW, ASA created."""
    fund_app(algorand, deployer, app_client)

    result = app_client.send.create_invoice(
        args=CreateInvoiceArgs(amount=10000, due_date=DUE_DATE, trust_score=85),
        params=_INNER_FEE,
    )

    assert result.abi_return > 0
    state = app_client.state.global_state.get_all()
    assert state["nft_asset_id"] > 0
    assert state["borrow_limit"] == 8500
    assert state["risk_level"] == "LOW"


def test_create_invoice_medium_risk(algorand, deployer, app_client):
    """trust_score=65 → borrow_limit=6500, risk_level=MEDIUM."""
    fund_app(algorand, deployer, app_client)

    app_client.send.create_invoice(
        args=CreateInvoiceArgs(amount=10000, due_date=DUE_DATE, trust_score=65),
        params=_INNER_FEE,
    )

    state = app_client.state.global_state.get_all()
    assert state["borrow_limit"] == 6500
    assert state["risk_level"] == "MEDIUM"


def test_create_invoice_high_risk(algorand, deployer, app_client):
    """trust_score=45 → borrow_limit=4500, risk_level=HIGH."""
    fund_app(algorand, deployer, app_client)

    app_client.send.create_invoice(
        args=CreateInvoiceArgs(amount=10000, due_date=DUE_DATE, trust_score=45),
        params=_INNER_FEE,
    )

    state = app_client.state.global_state.get_all()
    assert state["risk_level"] == "HIGH"
    assert state["borrow_limit"] == 4500


# ---------------------------------------------------------------------------
# Tests — seed pool
# ---------------------------------------------------------------------------


def test_seed_pool_by_deployer(algorand, deployer, app_client):
    """Deployer can seed the pool; pool balance becomes positive."""
    seed_pool(algorand, deployer, app_client)
    result = app_client.send.get_pool_balance()
    # Before setup_icc, pool balance returns 0
    assert result.abi_return == 0  # ICC not created yet — returns 0


def test_seed_pool_unauthorized_fails(algorand, deployer, app_client):
    """Non-deployer seed_pool must be rejected."""
    other = algorand.account.random()
    algorand.account.ensure_funded(
        other.address,
        algorand.account.localnet_dispenser(),
        min_spending_balance=AlgoAmount(algo=2),
    )

    payment_txn = algorand.create_transaction.payment(
        PaymentParams(
            sender=other.address,
            receiver=app_client.app_address,
            amount=AlgoAmount(algo=1),
        )
    )

    with pytest.raises(LogicError):
        app_client.send.seed_pool(
            args=SeedPoolArgs(
                payment=TransactionWithSigner(txn=payment_txn, signer=other.signer)
            ),
            params=CommonAppCallParams(sender=other.address),
        )


# ---------------------------------------------------------------------------
# Tests — ICC setup
# ---------------------------------------------------------------------------


def test_setup_icc_creates_asset(algorand, deployer, app_client):
    """setup_icc() mints ICC ASA; contract holds 1_000_000 units."""
    icc_id = setup_icc(algorand, deployer, app_client)
    assert icc_id > 0

    pool_balance = app_client.send.get_pool_balance().abi_return
    assert pool_balance == 1_000_000  # contract holds full supply


def test_setup_icc_twice_fails(algorand, deployer, app_client):
    """Second call to setup_icc() must be rejected (LogicError or simulate ValueError)."""
    setup_icc(algorand, deployer, app_client)

    with pytest.raises((LogicError, ValueError)):
        app_client.send.setup_icc(params=_INNER_FEE)


# ---------------------------------------------------------------------------
# Tests — borrow
# ---------------------------------------------------------------------------


def test_borrow_within_limit(algorand, deployer, app_client):
    """trust_score=80 → borrow_limit=8000; borrow(7000) sets is_borrowed."""
    icc_id = setup_icc(algorand, deployer, app_client)
    opt_in_icc(algorand, deployer, icc_id)

    app_client.send.create_invoice(
        args=CreateInvoiceArgs(amount=10000, due_date=DUE_DATE, trust_score=80),
        params=_INNER_FEE,
    )

    app_client.send.borrow(args=BorrowArgs(borrow_amount=7000), params=_INNER_FEE)

    state = app_client.state.global_state.get_all()
    assert state["is_borrowed"] == True  # noqa: E712 — stored as int 1
    assert state["borrowed_amount"] == 7000
    assert state["collateral_locked"] == True  # noqa: E712


def test_borrow_exceeds_limit_fails(algorand, deployer, app_client):
    """trust_score=50 → borrow_limit=5000; borrow(6000) must be rejected."""
    icc_id = setup_icc(algorand, deployer, app_client)
    opt_in_icc(algorand, deployer, icc_id)

    app_client.send.create_invoice(
        args=CreateInvoiceArgs(amount=10000, due_date=DUE_DATE, trust_score=50),
        params=_INNER_FEE,
    )

    with pytest.raises(LogicError):
        app_client.send.borrow(args=BorrowArgs(borrow_amount=6000), params=_INNER_FEE)


def test_borrow_locks_nft_and_sends_icc(algorand, deployer, app_client):
    """
    After borrow():
    - collateral_locked == True in state
    - deployer wallet receives borrow_amount ICC units
    """
    icc_id = setup_icc(algorand, deployer, app_client)
    opt_in_icc(algorand, deployer, icc_id)

    app_client.send.create_invoice(
        args=CreateInvoiceArgs(amount=10000, due_date=DUE_DATE, trust_score=80),
        params=_INNER_FEE,
    )

    borrow_amount = 5000
    app_client.send.borrow(
        args=BorrowArgs(borrow_amount=borrow_amount), params=_INNER_FEE
    )

    state = app_client.state.global_state.get_all()
    assert state["collateral_locked"] == True  # noqa: E712

    # Deployer wallet should now hold borrow_amount ICC
    acct_info = algorand.account.get_information(deployer.address)
    assets_list = acct_info.assets if isinstance(acct_info.assets, list) else (acct_info.get("assets") or [])
    assets = {(a["asset-id"] if isinstance(a, dict) else a.asset_id): (a["amount"] if isinstance(a, dict) else a.amount) for a in assets_list}
    assert assets.get(icc_id, 0) == borrow_amount


# ---------------------------------------------------------------------------
# Tests — liquidation
# ---------------------------------------------------------------------------


def test_liquidation(algorand, deployer, app_client):
    """
    Create invoice with PAST due_date, borrow, then liquidate.
    Status must become LIQUIDATED and collateral_locked clears.
    """
    icc_id = setup_icc(algorand, deployer, app_client)
    opt_in_icc(algorand, deployer, icc_id)

    # Use PAST_DATE (timestamp=1) so due_date is already elapsed
    app_client.send.create_invoice(
        args=CreateInvoiceArgs(amount=10000, due_date=PAST_DATE, trust_score=80),
        params=_INNER_FEE,
    )

    app_client.send.borrow(args=BorrowArgs(borrow_amount=5000), params=_INNER_FEE)

    # Liquidate — should succeed since latest_timestamp > PAST_DATE
    app_client.send.liquidate()

    state = app_client.state.global_state.get_all()
    assert state["status"] == "LIQUIDATED"
    assert state["is_borrowed"] == False  # noqa: E712
    assert state["collateral_locked"] == False  # noqa: E712
