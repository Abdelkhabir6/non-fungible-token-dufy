const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DufyNFT Hybrid Marketplace", function () {
    let DufyNFT, dufyNFT, owner, creator, buyer, other;

    beforeEach(async function () {
        [owner, creator, buyer, other] = await ethers.getSigners();
        DufyNFT = await ethers.getContractFactory("DufyNFT");
        dufyNFT = await DufyNFT.deploy(owner.address);
        if (dufyNFT.waitForDeployment) {
            await dufyNFT.waitForDeployment();
        } else {
            await dufyNFT.deployed();
        }
    });

    it("Should mint with specific royalties", async function () {
        const uri = "ipfs://example";
        const royaltyFee = 500; // 5%

        // Creator mints
        await dufyNFT.connect(creator).mint(creator.address, uri, royaltyFee);

        const tokenId = 0;
        expect(await dufyNFT.ownerOf(tokenId)).to.equal(creator.address);

        // Check Royalty Info
        const salePrice = ethers.parseEther("100");
        const [receiver, amount] = await dufyNFT.royaltyInfo(tokenId, salePrice);

        expect(receiver).to.equal(creator.address);
        expect(amount).to.equal(ethers.parseEther("5")); // 5% of 100
    });

    it("Should handle the full Sale flow (Put for Sale -> Buy -> Pay Royalties)", async function () {
        const uri = "ipfs://art";
        const royaltyFee = 1000; // 10%

        // 1. Creator mints Token #0
        await dufyNFT.connect(creator).mint(creator.address, uri, royaltyFee);

        // 2. Creator puts it for sale for 10 ETH
        const price = ethers.parseEther("10");
        await dufyNFT.connect(creator).putNFTForSale(0, price);

        const saleInfo = await dufyNFT.getNFTSale(0);
        expect(saleInfo.isForSale).to.be.true;
        expect(saleInfo.price).to.equal(price);

        // 3. Buyer buys it
        // Check balances before
        const initialCreatorBal = await ethers.provider.getBalance(creator.address);
        // Note: Creator pays gas for putting on sale, but here we just check the receiving part roughly or use changeEtherBalance

        await expect(
            dufyNFT.connect(buyer).buyNFT(0, { value: price })
        ).to.changeEtherBalances(
            [creator, buyer],
            [price, -price]
        );
        // Creator receives:
        // Royalty (10% of 10 = 1 ETH)
        // + Seller Share (Price - Royalty = 9 ETH)
        // Total = 10 ETH (because Creator IS the Seller)

        // Verify Ownership
        expect(await dufyNFT.ownerOf(0)).to.equal(buyer.address);
    });

    it("Should distribute Royalties correctly on Secondary Sale", async function () {
        const uri = "ipfs://secondary";
        const royaltyFee = 1000; // 10%

        // 1. Creator mints Token #0
        await dufyNFT.connect(creator).mint(creator.address, uri, royaltyFee);

        // 2. Creator transfers to Seller (Secondary Market scenario logic setup)
        // Let's say Creator sold it to "other" (Seller) first simply by transfer/gift for test simplicity
        await dufyNFT.connect(creator).transferFrom(creator.address, other.address, 0);
        expect(await dufyNFT.ownerOf(0)).to.equal(other.address);

        // 3. "Other" (Seller) puts it for sale for 100 ETH
        const price = ethers.parseEther("100");
        await dufyNFT.connect(other).putNFTForSale(0, price);

        // 4. Buyer buys it
        // Expectation:
        // Creator gets 10% (10 ETH)
        // Seller ("Other") gets 90% (90 ETH)
        // Buyer spends 100 ETH

        await expect(
            dufyNFT.connect(buyer).buyNFT(0, { value: price })
        ).to.changeEtherBalances(
            [creator, other, buyer],
            [ethers.parseEther("10"), ethers.parseEther("90"), -price]
        );

        expect(await dufyNFT.ownerOf(0)).to.equal(buyer.address);
    });
});
