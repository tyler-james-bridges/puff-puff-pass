// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title PuffReceiver — x402 payment receiver for puff-puff-pass
/// @notice Accepts ERC-20 tokens (USDC) and lets the owner withdraw
contract PuffReceiver {
    address public immutable owner;

    constructor() {
        owner = msg.sender;
    }

    /// @notice Withdraw any ERC-20 token to the owner
    function withdraw(address token) external {
        require(msg.sender == owner, "not owner");
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(bal > 0, "no balance");
        bool ok = IERC20(token).transfer(owner, bal);
        require(ok, "transfer failed");
    }

    /// @notice Withdraw native ETH if any gets sent here
    function withdrawETH() external {
        require(msg.sender == owner, "not owner");
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "transfer failed");
    }

    receive() external payable {}
}
