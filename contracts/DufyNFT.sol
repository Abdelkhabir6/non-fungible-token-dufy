// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DufyNFT is ERC721URIStorage, ERC2981, Ownable {
    uint256 private _nextTokenId;

    struct NFTSale {
        address seller;
        uint256 price;
        bool isForSale;
    }

    // Map tokenId to its Sale info
    mapping(uint256 => NFTSale) public nftSales;

    constructor(address initialOwner) ERC721("DufyNFT", "DUFY") Ownable(initialOwner) {}

    /**
     * @dev Public minting function. 
     * Allows anyone to mint a Dufy NFT.
     * @param to The address receiving the NFT.
     * @param uri The IPFS URI.
     * @param royaltyFee The royalty percentage in basis points (e.g. 500 = 5%).
     */
    function mint(address to, string memory uri, uint96 royaltyFee) public {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);

        // Set royalty for this specific token. 
        // The creator (msg.sender) receives the royalties.
        _setTokenRoyalty(tokenId, msg.sender, royaltyFee);
    }

    /**
     * @dev Put an NFT currently owned by msg.sender for sale.
     */
    function putNFTForSale(uint256 tokenId, uint256 price) public {
        require(ownerOf(tokenId) == msg.sender, "You are not the owner");
        require(price > 0, "Price must be greater than 0");

        nftSales[tokenId] = NFTSale({
            seller: msg.sender,
            price: price,
            isForSale: true
        });
    }

    /**
     * @dev Buy an NFT that is for sale.
     * Distributes Royalties to the creator and the rest to the seller.
     */
    function buyNFT(uint256 tokenId) public payable {
        NFTSale memory sale = nftSales[tokenId];
        require(sale.isForSale, "NFT not for sale");
        require(msg.value >= sale.price, "Insufficient funds sent");

        address seller = sale.seller;
        
        // Calculate Royalties via ERC2981 standard
        (address royaltyReceiver, uint256 royaltyAmount) = royaltyInfo(tokenId, msg.value);

        // Amount for the seller = Price - Royalty
        uint256 sellerAmount = msg.value - royaltyAmount;

        // 1. Pay Royalty (if any)
        if (royaltyAmount > 0) {
            payable(royaltyReceiver).transfer(royaltyAmount);
        }

        // 2. Pay Seller
        payable(seller).transfer(sellerAmount);

        // 3. Transfer NFT ownership
        _transfer(seller, msg.sender, tokenId);

        // 4. Close the sale
        delete nftSales[tokenId];
    }

    /**
     * @dev Get sale details for a token
     */
    function getNFTSale(uint256 tokenId) public view returns (NFTSale memory) {
        return nftSales[tokenId];
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function totalSupply() public view returns (uint256) {
        return _nextTokenId;
    }
}
