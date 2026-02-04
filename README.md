# Non-Fungible Token Dufy

|   Nom   | Prénom |
|---------|--------|
|   SHAB   |  Abdelkhabir  |

Le TP est à réaliser individuellement.

## Présentation

Raoul Dufy [2], célèbre pour ses peintures colorées et vives, ainsi que ses illustrations et motifs textiles, a laissé une œuvre artistique significative. Ce projet propose d'explorer comment les œuvres d'art, en particulier des illustrations inspirées du style de Dufy, peuvent être transformées en NFT (tokens non fongibles) [1] et vendues sur la Blockchain tout en assurant la protection des droits d'auteur et la mise en place d'un système de redevances pour l'artiste ou ses ayant droits. Cela permettrait de perpétuer l'héritage de Dufy à l'ère numérique tout en explorant le potentiel économique des NFT.

Le projet vise à créer un Smart Contract pour la vente de NFT représentant des illustrations dans le style de Raoul Dufy. Chaque illustration sera unique et authentifiée (à l'aide d'une empreinte numérique) grâce à la Blockchain. Le Smart Contract implémentera également un système de royalties, garantissant que l'artiste ou ses ayants droit reçoivent une commission à chaque revente de l’œuvre numérique, même après la vente initiale.

- [1] « NFT - Définitions, synonymes, prononciation, exemples | Dico en ligne Le Robert ». [En ligne]. Disponible sur: https://dictionnaire.lerobert.com/definition/nft
- [2] « Raoul Dufy — Wikipédia ». [En ligne]. Disponible sur: https://fr.wikipedia.org/wiki/Raoul_Dufy



## Restitution

Il est nécessaire de tester le Smart Contract, il est donc demandé de rédiger des tests unitaires ainsi que de la documentation à propos du Smart Contract mais aussi de l'application décentralisée.

# Documentation Technique

## 1. Architecture du Projet

Le projet est une **Application Décentralisée (DApp)** complète permettant de créer (mintu), vendre et acheter des NFTs inspirés de Raoul Dufy. Elle repose sur trois piliers :
*   **Blockchain** : Hardhat Localhost (Ethereum compatible) pour la logique métier et les transactions.
*   **Stockage Décentralisé** : IPFS (via Helia) pour héberger les images des œuvres de manière immuable.
*   **Frontend** : Application React (Vite) connectée via Ethers.js.

---

## 2. Smart Contract (`contracts/DufyNFT.sol`)

Le contrat intelligent `DufyNFT` est le cœur du système. Il hérite des standards sécurisés d'OpenZeppelin.

### Standards Implémentés
1.  **ERC721URIStorage** : Standard de base pour les NFTs avec gestion avancée des métadonnées (URI).
2.  **ERC2981 (Royalty Standard)** : Standard officiel pour la gestion des droits de suite (royalties) sur la blockchain.
3.  **Ownable** : Gestion des permissions d'administration.

### Fonctions Principales

#### `mint(address to, string memory uri, uint96 royaltyFee)`
Permet à n'importe quel utilisateur de créer une œuvre unique.
*   **uri** : L'identifiant IPFS de l'image (ex: `ipfs://bafy...`).
*   **royaltyFee** : Le pourcentage que le créateur touchera à vie sur les reventes (en points de base, ex: 500 = 5%).
*   **Action** : Le contrat configure le créateur comme bénéficiaire des royalties pour ce token spécifique (`_setTokenRoyalty`).

#### `putNFTForSale(uint256 tokenId, uint256 price)`
Permet au propriétaire actuel de mettre son NFT en vente sur la "Marketplace" intégrée au contrat.

#### `buyNFT(uint256 tokenId)`
L'acte d'achat qui déclenche automatiquement la répartition des fonds :
1.  Le contrat calcule la part du créateur (`royaltyInfo`).
2.  **Paiement des Royalties** : Le créateur reçoit immédiatement son pourcentage (même s'il n'est plus propriétaire).
3.  **Paiement du Vendeur** : Le vendeur reçoit le reste (`Prix - Royalties`).
4.  **Transfert du NFT** : La propriété change de main.

---

## 3. Application Décentralisée (Frontend)

L'interface utilisateur (`frontend/src/App.jsx`) permet d'interagir avec la blockchain sans ligne de commande.

### Technologies Clés
*   **React (Vite)** : Framework UI rapide.
*   **Ethers.js (v6)** : Librairie pour connecter le Wallet (MetaMask) et appeler les fonctions du Smart Contract.
*   **Helia (IPFS)** : Nœud IPFS JavaScript tournant directement dans le navigateur de l'utilisateur.

### Flux de Données (Minting Flow)

1.  **Upload** : L'utilisateur sélectionne une image.
2.  **IPFS (Local)** : Le nœud Helia du navigateur ajoute le fichier au réseau IPFS et génère un **CID** (Content Identifier).
3.  **Persistance** : Pour pallier la volatilité du nœud navigateur, l'image est mise en cache dans le `localStorage` pour un affichage immédiat.
4.  **Blockchain** : L'application demande à MetaMask de signer la transaction `mint()` avec le CID IPFS.
5.  **Confirmation** : Une fois miné, le NFT apparaît dans la galerie globale.

### Gestion des Erreurs et Réseau
L'application vérifie automatiquement que l'utilisateur est connecté au bon réseau (Localhost Chain ID `31337`) pour éviter les pertes de fonds ou les erreurs de contrat introuvable.
