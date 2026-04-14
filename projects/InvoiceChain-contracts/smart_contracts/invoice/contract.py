from algopy import ARC4Contract, Asset, Global, String, Txn, UInt64, gtxn, itxn
from algopy.arc4 import abimethod

SCALE = 100  # plain int — used as UInt64(SCALE) inside methods


class Invoice(ARC4Contract):
    def __init__(self) -> None:
        # ICC token
        self.icc_asset_id = UInt64(0)
        # Invoice fields
        self.amount = UInt64(0)
        self.due_date = UInt64(0)
        self.trust_score = UInt64(0)
        self.risk_level = String("")
        self.borrow_limit = UInt64(0)
        self.nft_asset_id = UInt64(0)
        # Loan state
        self.is_borrowed = False
        self.borrowed_amount = UInt64(0)
        self.collateral_locked = False
        self.status = String("ACTIVE")

    # ------------------------------------------------------------------
    # ICC setup
    # ------------------------------------------------------------------

    @abimethod
    def setup_icc(self) -> UInt64:
        """
        Mint the InvoiceChain Credit (ICC) ASA.
        Must be called once by the deployer immediately after contract creation.
        The contract account holds the full supply and distributes via borrow().
        """
        assert Txn.sender == Global.creator_address, "Only deployer"
        assert self.icc_asset_id == UInt64(0), "ICC already created"

        result = itxn.AssetConfig(
            total=1_000_000,
            decimals=2,
            unit_name="ICC",
            asset_name="InvoiceChain Credit",
            url="https://invoicechain.app",
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address,
        ).submit()

        self.icc_asset_id = result.created_asset.id
        return result.created_asset.id

    # ------------------------------------------------------------------
    # Pool management
    # ------------------------------------------------------------------

    @abimethod
    def seed_pool(self, payment: gtxn.PaymentTransaction) -> None:
        """
        Deployer sends ALGO to the contract to cover minimum balances and inner
        transaction fees. ICC supply is already held by the contract after setup_icc.
        """
        assert Txn.sender == Global.creator_address, "Only deployer can seed pool"
        assert (
            payment.receiver == Global.current_application_address
        ), "Payment must go to contract"
        assert payment.amount > UInt64(0), "Payment must be positive"

    @abimethod(readonly=True)
    def get_pool_balance(self) -> UInt64:
        """Return the ICC balance held by the contract (available for lending)."""
        if self.icc_asset_id == UInt64(0):
            return UInt64(0)
        return Asset(self.icc_asset_id).balance(Global.current_application_address)

    # ------------------------------------------------------------------
    # Invoice lifecycle
    # ------------------------------------------------------------------

    @abimethod
    def create_invoice(
        self, amount: UInt64, due_date: UInt64, trust_score: UInt64
    ) -> UInt64:
        """
        Mint an ARC-3 Invoice NFT.
        The NFT is held by the contract as implicit collateral until repayment.
        Returns the new ASA ID.
        """
        assert trust_score <= UInt64(SCALE), "trust_score must be 0-100"

        borrow_limit = amount * trust_score // UInt64(SCALE)

        risk = String("HIGH")
        if trust_score >= UInt64(80):
            risk = String("LOW")
        elif trust_score >= UInt64(60):
            risk = String("MEDIUM")

        result = itxn.AssetConfig(
            total=1,
            decimals=0,
            unit_name="INV",
            asset_name="InvoiceNFT",
            url="https://invoicechain.app/metadata#arc3",
            manager=Global.current_application_address,
        ).submit()

        self.amount = amount
        self.due_date = due_date
        self.trust_score = trust_score
        self.risk_level = risk
        self.borrow_limit = borrow_limit
        self.nft_asset_id = result.created_asset.id
        self.is_borrowed = False
        self.borrowed_amount = UInt64(0)
        self.collateral_locked = False
        self.status = String("ACTIVE")

        return result.created_asset.id

    @abimethod
    def borrow(self, borrow_amount: UInt64) -> None:
        """
        Lock the invoice NFT as collateral (held by contract) and transfer
        borrow_amount ICC to Txn.sender.

        The NFT is already held by the contract since create_invoice — locking
        is enforced via collateral_locked state. The ICC transfer is the
        on-chain proof of the loan.

        Caller must have opted in to the ICC ASA before calling this method.
        """
        assert self.icc_asset_id > UInt64(0), "ICC not initialised"
        assert self.nft_asset_id > UInt64(0), "No invoice minted"
        assert not self.is_borrowed, "Invoice already borrowed against"
        assert not self.collateral_locked, "Collateral already locked"
        assert borrow_amount <= self.borrow_limit, "Exceeds borrow limit"
        assert self.status == String("ACTIVE"), "Invoice not active"

        pool_icc = Asset(self.icc_asset_id).balance(Global.current_application_address)
        assert pool_icc >= borrow_amount, "Insufficient ICC in pool"

        # Inner txn: send ICC to the borrower
        itxn.AssetTransfer(
            xfer_asset=self.icc_asset_id,
            asset_receiver=Txn.sender,
            asset_amount=borrow_amount,
        ).submit()

        self.is_borrowed = True
        self.borrowed_amount = borrow_amount
        self.collateral_locked = True

    @abimethod
    def repay(self, icc_transfer: gtxn.AssetTransferTransaction) -> None:
        """
        SME repays the loan by sending ICC back.
        gtxn[0] must be an ICC asset transfer to this contract.
        On success the collateral lock is released.
        """
        assert self.is_borrowed, "No active borrow"
        assert icc_transfer.xfer_asset.id == self.icc_asset_id, "Must repay with ICC"
        assert (
            icc_transfer.asset_receiver == Global.current_application_address
        ), "ICC must go to contract"
        assert icc_transfer.asset_amount >= self.borrowed_amount, "Insufficient repayment"

        self.is_borrowed = False
        self.borrowed_amount = UInt64(0)
        self.collateral_locked = False

    @abimethod
    def liquidate(self) -> None:
        """
        Creator liquidates an overdue position.
        Callable only after due_date has passed and a borrow is active.
        The NFT remains in the contract — it is not returned to the borrower.
        """
        assert Txn.sender == Global.creator_address, "Only creator can liquidate"
        assert self.is_borrowed, "No active borrow to liquidate"
        assert Global.latest_timestamp > self.due_date, "Invoice not yet overdue"

        self.is_borrowed = False
        self.collateral_locked = False
        self.status = String("LIQUIDATED")

    # ------------------------------------------------------------------
    # Read-only helpers
    # ------------------------------------------------------------------

    @abimethod(readonly=True)
    def get_invoice_info(
        self,
    ) -> tuple[UInt64, UInt64, UInt64, String, UInt64, bool, UInt64, UInt64, bool, String, UInt64]:
        return (
            self.amount,
            self.due_date,
            self.trust_score,
            self.risk_level,
            self.borrow_limit,
            self.is_borrowed,
            self.borrowed_amount,
            self.nft_asset_id,
            self.collateral_locked,
            self.status,
            self.icc_asset_id,
        )
