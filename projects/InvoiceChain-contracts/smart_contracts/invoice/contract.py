from algopy import ARC4Contract, Global, String, Txn, UInt64, gtxn, itxn
from algopy.arc4 import abimethod

SCALE = 100


class Invoice(ARC4Contract):
    def __init__(self) -> None:
        self.amount = UInt64(0)
        self.due_date = UInt64(0)
        self.trust_score = UInt64(0)
        self.risk_level = String("")
        self.borrow_limit = UInt64(0)
        self.nft_asset_id = UInt64(0)
        self.is_borrowed = False
        self.borrowed_amount = UInt64(0)

    # ------------------------------------------------------------------
    # Pool management
    # ------------------------------------------------------------------

    @abimethod
    def seed_pool(self, payment: gtxn.PaymentTransaction) -> None:
        """Deposit ALGO into the lending pool. Only the deployer may call this."""
        assert Txn.sender == Global.creator_address, "Only deployer can seed pool"
        assert (
            payment.receiver == Global.current_application_address
        ), "Payment must go to contract"
        assert payment.amount > UInt64(0), "Payment must be positive"

    @abimethod(readonly=True)
    def get_pool_balance(self) -> UInt64:
        """Return the contract ALGO balance available for lending (balance minus MBR)."""
        balance = Global.current_application_address.balance
        min_bal = Global.min_balance
        if balance > min_bal:
            return balance - min_bal
        return UInt64(0)

    # ------------------------------------------------------------------
    # Invoice lifecycle
    # ------------------------------------------------------------------

    @abimethod
    def create_invoice(
        self, amount: UInt64, due_date: UInt64, trust_score: UInt64
    ) -> UInt64:
        assert trust_score <= UInt64(SCALE), "trust_score must be 0-100"

        borrow_limit = amount * trust_score // UInt64(SCALE)

        risk = String("HIGH")
        if trust_score >= UInt64(80):
            risk = String("LOW")
        elif trust_score >= UInt64(60):
            risk = String("MEDIUM")

        # ARC-3 NFT: total=1, decimals=0, URL ends with #arc3
        itxn_result = itxn.AssetConfig(
            total=1,
            decimals=0,
            unit_name="INV",
            asset_name="InvoiceNFT",
            url="https://invoicechain.example.com/metadata#arc3",
            manager=Global.current_application_address,
        ).submit()

        self.amount = amount
        self.due_date = due_date
        self.trust_score = trust_score
        self.risk_level = risk
        self.borrow_limit = borrow_limit
        self.nft_asset_id = itxn_result.created_asset.id
        self.is_borrowed = False
        self.borrowed_amount = UInt64(0)

        return itxn_result.created_asset.id

    @abimethod
    def borrow(self, borrow_amount: UInt64) -> None:
        """
        Transfer borrow_amount microAlgos from the pool to the caller (SME).
        The ALGO moves from the contract account directly to Txn.sender —
        Account A (lender/pool) is never involved after seeding.
        """
        assert not self.is_borrowed, "Invoice already borrowed against"
        assert borrow_amount <= self.borrow_limit, "Exceeds borrow limit"
        assert (
            Global.current_application_address.balance
            >= borrow_amount + Global.min_balance
        ), "Insufficient pool balance"

        # Inner payment: contract → Txn.sender (the SME calling borrow)
        itxn.Payment(
            receiver=Txn.sender,
            amount=borrow_amount,
        ).submit()

        self.is_borrowed = True
        self.borrowed_amount = borrow_amount

    @abimethod
    def repay(self, payment: gtxn.PaymentTransaction) -> None:
        assert self.is_borrowed, "No active borrow"
        assert payment.amount >= self.borrowed_amount, "Insufficient repayment"

        self.is_borrowed = False
        self.borrowed_amount = UInt64(0)

    @abimethod(readonly=True)
    def get_invoice_info(
        self,
    ) -> tuple[UInt64, UInt64, UInt64, String, UInt64, bool, UInt64, UInt64]:
        return (
            self.amount,
            self.due_date,
            self.trust_score,
            self.risk_level,
            self.borrow_limit,
            self.is_borrowed,
            self.borrowed_amount,
            self.nft_asset_id,
        )
