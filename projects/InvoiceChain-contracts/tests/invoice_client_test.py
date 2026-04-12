import pytest
from algosdk.atomic_transaction_composer import TransactionWithSigner
from algokit_utils import AlgoAmount, AlgorandClient, CommonAppCallParams, LogicError, PaymentParams, SendParams

# extra_fee covers the 1 inner transaction fee (AssetConfig or Payment)
_INNER_FEE = CommonAppCallParams(extra_fee=AlgoAmount.from_micro_algo(1000))

from smart_contracts.artifacts.invoice.invoice_client import (
    BorrowArgs,
    CreateInvoiceArgs,
    InvoiceFactory,
    SeedPoolArgs,
)

# Far-future Unix timestamp — not asserted on, just a valid value
DUE_DATE = 2_000_000_000


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def algorand() -> AlgorandClient:
    return AlgorandClient.default_localnet()


@pytest.fixture
def deployer(algorand: AlgorandClient):
    account = algorand.account.random()
    dispenser = algorand.account.localnet_dispenser()
    algorand.account.ensure_funded(
        account.address,
        dispenser,
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
# Helper
# ---------------------------------------------------------------------------


def fund_app(algorand: AlgorandClient, deployer, app_client, algo: int = 1) -> None:
    """Seed the contract account so inner transactions and borrows can proceed."""
    algorand.send.payment(
        PaymentParams(
            sender=deployer.address,
            receiver=app_client.app_address,
            amount=AlgoAmount(algo=algo),
        )
    )


# ---------------------------------------------------------------------------
# Tests
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


def test_borrow_within_limit(algorand, deployer, app_client):
    """trust_score=80 → borrow_limit=8000; borrow(7000) succeeds."""
    fund_app(algorand, deployer, app_client)

    app_client.send.create_invoice(
        args=CreateInvoiceArgs(amount=10000, due_date=DUE_DATE, trust_score=80),
        params=_INNER_FEE,
    )

    app_client.send.borrow(args=BorrowArgs(borrow_amount=7000), params=_INNER_FEE)

    state = app_client.state.global_state.get_all()
    assert state["is_borrowed"] == True  # noqa: E712 — stored as int 1
    assert state["borrowed_amount"] == 7000


def test_borrow_exceeds_limit_fails(algorand, deployer, app_client):
    """trust_score=50 → borrow_limit=5000; borrow(6000) must be rejected."""
    fund_app(algorand, deployer, app_client)

    app_client.send.create_invoice(
        args=CreateInvoiceArgs(amount=10000, due_date=DUE_DATE, trust_score=50),
        params=_INNER_FEE,
    )

    with pytest.raises(LogicError):
        app_client.send.borrow(args=BorrowArgs(borrow_amount=6000), params=_INNER_FEE)


def test_seed_pool_by_deployer(algorand, deployer, app_client):
    """Deployer can seed the pool; pool balance becomes positive."""
    payment_txn = algorand.create_transaction.payment(
        PaymentParams(
            sender=deployer.address,
            receiver=app_client.app_address,
            amount=AlgoAmount(algo=1),
        )
    )
    app_client.send.seed_pool(
        args=SeedPoolArgs(payment=TransactionWithSigner(txn=payment_txn, signer=deployer.signer))
    )

    result = app_client.send.get_pool_balance()
    assert result.abi_return > 0


def test_seed_pool_unauthorized_fails(algorand, deployer, app_client):
    """Non-deployer call to seed_pool must be rejected with LogicError."""
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
            args=SeedPoolArgs(payment=TransactionWithSigner(txn=payment_txn, signer=other.signer)),
            params=CommonAppCallParams(sender=other.address),
        )


def test_get_pool_balance(algorand, deployer, app_client):
    """get_pool_balance returns balance minus MBR after direct funding."""
    fund_app(algorand, deployer, app_client, algo=1)

    result = app_client.send.get_pool_balance()
    assert result.abi_return > 0
