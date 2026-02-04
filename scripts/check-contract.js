const hre = require("hardhat");

async function main() {
    const address = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
    const code = await hre.ethers.provider.getCode(address);
    console.log(`Code at ${address}: ${code.slice(0, 10)}... (Length: ${code.length})`);

    if (code === "0x") {
        console.error("ERROR: Contract does not exist at this address!");
        process.exit(1);
    } else {
        console.log("SUCCESS: Contract found!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
