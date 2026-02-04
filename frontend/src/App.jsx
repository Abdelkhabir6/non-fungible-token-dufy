import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';
import DufyNFTABI from './DufyNFT.json';
import './App.css';

const CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

const NFTImage = ({ uri, fs }) => {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!uri) return;
      const cidStr = uri.replace("ipfs://", "");

      // 0. Try LocalStorage Cache (Immediate & Persistent)
      const cached = localStorage.getItem(cidStr);
      if (cached) {
        setSrc(cached);
        return;
      }

      // 1. Try Gateway first (for caching) or parallel?own content)
      if (fs) {
        try {
          console.log("Fetching from Helia local:", cidStr);
          const chunks = [];
          // fs.cat returns AsyncIterable<Uint8Array>
          for await (const chunk of fs.cat(cidStr)) {
            chunks.push(chunk);
          }
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: "image/*" });
            setSrc(URL.createObjectURL(blob));
            return;
          }
        } catch (e) {
          console.warn("Helia local fetch error:", e);
        }
      }

      // Fallback to Gateway
      setSrc(`https://dweb.link/ipfs/${cidStr}`);
    };
    load();
  }, [uri, fs]);

  if (!src) return <div style={{ height: '200px', background: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>Chargement IPFS...</div>;

  return (
    <div style={{
      height: '200px',
      backgroundColor: '#eee',
      backgroundImage: `url(${src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      marginBottom: '1rem',
      borderRadius: '8px'
    }}></div>
  );
};

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);

  // Mint Form State
  const [selectedFile, setSelectedFile] = useState(null);
  const [royalty, setRoyalty] = useState(5);

  // Sell Form State
  const [sellId, setSellId] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  // Buy Form State
  const [buyId, setBuyId] = useState("");

  // Gallery State
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Helia State
  const [helia, setHelia] = useState(null);
  const [fs, setFs] = useState(null);

  useEffect(() => {
    checkWallet();
    initHelia();
  }, []);

  useEffect(() => {
    if (contract && account) {
      loadGallery();
      const onTransfer = () => loadGallery();
      contract.on("Transfer", onTransfer);
      return () => {
        contract.off("Transfer", onTransfer);
      };
    }
  }, [contract, account]);

  const initHelia = async () => {
    try {
      const heliaNode = await createHelia();
      const fsNode = unixfs(heliaNode);
      setHelia(heliaNode);
      setFs(fsNode);
    } catch (e) {
      console.error("Error starting Helia:", e);
    }
  };

  const checkWallet = async () => {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        initContract(accounts[0]);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setAccount(accounts[0]);
    initContract(accounts[0]);
  };

  const disconnectWallet = () => {
    setAccount(null);
    setContract(null);
    setNfts([]);
  };

  const initContract = async (accountAddress) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      // Simple Network Check
      if (network.chainId !== 31337n) {
        alert("Veuillez connecter MetaMask au réseau Localhost 8545 (Chain ID 31337).");
        return;
      }

      const signer = await provider.getSigner();
      const nftContract = new ethers.Contract(CONTRACT_ADDRESS, DufyNFTABI.abi, signer);
      setContract(nftContract);
    } catch (error) {
      console.error("Error initializing contract:", error);
    }
  };


  const uploadToIPFS = async (file) => {
    if (!fs) throw new Error("IPFS node not ready");
    setStatus("Uploading to IPFS (Helia)...");
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    const cid = await fs.addBytes(fileBytes);
    const cidString = cid.toString();

    // Cache locally for immediate/offline retrieval
    const reader = new FileReader();
    reader.onloadend = () => {
      localStorage.setItem(cidString, reader.result);
    };
    reader.readAsDataURL(file);

    return cidString;
  };

  const mintNFT = async () => {
    if (!contract || !selectedFile) return;

    setLoading(true);
    setStatus("Minting...");

    try {
      const cid = await uploadToIPFS(selectedFile);
      const tokenURI = `ipfs://${cid}`;

      const royaltyBasisPoints = royalty * 100;
      const tx = await contract.mint(account, tokenURI, royaltyBasisPoints);
      const receipt = await tx.wait();

      // Clean ID retrieval from logs
      let mintedId = "Unknown";
      const transferEvent = receipt.logs.find(log => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed && parsed.name === "Transfer";
        } catch (e) { return false; }
      });

      if (transferEvent) {
        const parsed = contract.interface.parseLog(transferEvent);
        mintedId = parsed.args[2].toString();
      }

      setStatus(`Minted successfully! TOKEN ID: ${mintedId}`);
      setSelectedFile(null);
      setTimeout(loadGallery, 1000);
    } catch (error) {
      console.error(error);
      setStatus("Error: " + (error.reason || error.message));
    }
    setLoading(false);
  };




  const handleSell = async () => {
    if (!sellId || !sellPrice) {
      alert("Entrez l'ID et le Prix");
      return;
    }
    setLoading(true);
    try {
      const priceWei = ethers.parseEther(sellPrice);
      const tx = await contract.putNFTForSale(sellId, priceWei);
      await tx.wait();
      alert(`NFT #${sellId} mis en vente pour ${sellPrice} ETH!`);
      setSellId("");
      setSellPrice("");
      loadGallery();
    } catch (error) {
      alert("Erreur vente: " + (error.reason || error.message));
    }
    setLoading(false);
  };

  const handleBuy = async () => {
    if (!buyId) {
      alert("Entrez l'ID du NFT");
      return;
    }
    setLoading(true);
    try {
      // First get the price
      const sale = await contract.getNFTSale(buyId);
      if (!sale.isForSale) {
        alert("Ce NFT n'est pas en vente !");
        setLoading(false);
        return;
      }

      const price = sale.price; // Already in wei
      const tx = await contract.buyNFT(buyId, { value: price });
      await tx.wait();
      alert(`Vous avez acheté le NFT #${buyId} !`);
      setBuyId("");
      loadGallery();
    } catch (error) {
      alert("Erreur achat: " + (error.reason || error.message));
    }
    setLoading(false);
  };

  const resolveLink = (link) => {
    if (!link) return "";
    if (link.startsWith("ipfs://")) {
      // Use dweb.link (often faster for new content)
      return link.replace("ipfs://", "https://dweb.link/ipfs/");
    }
    return link;
  };

  const loadGallery = async () => {
    if (!contract) return;
    try {
      // Revert to (Improved) Event-based approach
      const filter = contract.filters.Transfer(null, null);
      const events = await contract.queryFilter(filter, 0); // Start from block 0
      const tokenIds = [...new Set(events.map(e => e.args[2].toString()))];

      const loadedNFTs = await Promise.all(tokenIds.map(async (idStr) => {
        try {
          const tokenId = BigInt(idStr);
          const uri = await contract.tokenURI(tokenId);
          const owner = await contract.ownerOf(tokenId);
          const sale = await contract.getNFTSale(tokenId);
          return {
            tokenId: idStr,
            uri,
            owner,
            isForSale: sale.isForSale,
            price: sale.price
          };
        } catch (e) {
          return null;
        }
      }));
      setNfts(loadedNFTs.filter(n => n !== null));
    } catch (error) {
      console.error("Error loading gallery:", error);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dufy NFT Collection</h1>
        {account && (
          <button onClick={disconnectWallet} style={{ backgroundColor: '#6c757d', fontSize: '0.8rem' }}>
            Déconnexion ({account.slice(0, 6)}...{account.slice(-4)})
          </button>
        )}
      </div>
      <p className="subtitle">Artistic Non-Fungible Tokens inspired by Raoul Dufy</p>

      {!account ? (
        <button onClick={connectWallet}>Connexion Wallet</button>
      ) : (
        <div>
          <p style={{ fontSize: '0.8rem', color: '#888' }}>
            {helia ? "🟢 IPFS Ready" : "🔴 IPFS Starting..."}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
            {/* MINT CARD */}
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h2>1. Mint NFT</h2>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label>Royalties (%):</label>
                  <input type="number" min="0" max="50" value={royalty} onChange={(e) => setRoyalty(e.target.value)} style={{ width: '60px' }} />
                </div>
                <button onClick={mintNFT} disabled={loading || !helia || !selectedFile}>
                  {loading ? "..." : "Mint"}
                </button>
              </div>
              {status && <p style={{ color: status.includes("Error") ? 'red' : 'green', fontSize: '0.8rem' }}>{status}</p>}
            </div>

            {/* SELL CARD */}
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h2>2. Vendre NFT</h2>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="text" placeholder="ID du NFT (ex: 0)"
                  value={sellId} onChange={(e) => setSellId(e.target.value)}
                />
                <input
                  type="text" placeholder="Prix (ETH)"
                  value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}
                />
                <button onClick={handleSell} disabled={loading} style={{ backgroundColor: 'orange' }}>
                  Mettre en Vente
                </button>
              </div>
            </div>

            {/* BUY CARD */}
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h2>3. Acheter NFT</h2>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="text" placeholder="ID du NFT (ex: 0)"
                  value={buyId} onChange={(e) => setBuyId(e.target.value)}
                />
                <button onClick={handleBuy} disabled={loading} style={{ backgroundColor: 'green' }}>
                  Acheter
                </button>
              </div>
            </div>
          </div>

          <h2>Galerie Globale</h2>
          <div className="gallery">
            {nfts.map((nft) => (
              <div key={nft.tokenId} className="nft-item" style={{ position: 'relative' }}>
                {nft.isForSale && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'red', color: 'white', padding: '5px 10px',
                    borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem'
                  }}>
                    {ethers.formatEther(nft.price)} ETH
                  </div>
                )}

                <NFTImage uri={nft.uri} fs={fs} />
                <p><strong>Dufy #{nft.tokenId}</strong></p>
                <p style={{ fontSize: '0.7rem', color: '#666' }}>
                  {nft.owner.toLowerCase() === account.toLowerCase() ? "Propriétaire: VOUS" : `Propriétaire: ${nft.owner.slice(0, 6)}...`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
