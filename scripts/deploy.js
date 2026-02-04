const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const DufyNFT = await hre.ethers.getContractFactory("DufyNFT");
    const dufyNFT = await DufyNFT.deploy(deployer.address);

    await dufyNFT.waitForDeployment();

    console.log("DufyNFT deployed to:", await dufyNFT.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
