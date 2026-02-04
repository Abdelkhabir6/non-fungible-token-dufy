const hre = require("hardhat");

async function main() {
    // This is Hardhat Account #1 (Private Key: 0x59c6...90d)
    const address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const balance = await hre.ethers.provider.getBalance(address);
    console.log(`Address: ${address}`);
    console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

    if (balance === 0n) {
        console.error("ERROR: Balance is 0! Node state might be corrupted or this is the wrong account.");
    } else {
        console.log("SUCCESS: Account is funded.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
