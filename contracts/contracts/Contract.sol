// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";

// Universal Account ID Struct and IUEAFactory Interface
struct UniversalAccountId {
    string chainNamespace;
    string chainId;
    bytes owner;
}

interface IUEAFactory {
    function getOriginForUEA(address addr) external view returns (UniversalAccountId memory account, bool isUEA);
}

interface IUltraVerifier {
    function getVerificationKeyHash() external pure returns (bytes32);

    function verify(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external view returns (bool);
}

/// @title ZKGameClient
/// @custom:security Lottery (`requestLottery`) uses on-chain pseudorandomness (`_lotteryEntropyWord`), not a VRF.
/// Block builders can bias `block.prevrandao` and ordering within a block. This is materially harder to game than
/// `salt + block.timestamp` but is **not** trust-minimized. For production-grade fairness, wire an oracle VRF
/// (e.g. Chainlink) or Somnia’s dedicated randomness primitive when available.
contract ZKGameClient is Ownable, ReentrancyGuard, SomniaEventHandler {
    // --- Custom errors -------------------------------------------------------------------------
    error InsufficientValue();
    error NotGamePlayer();
    error NoActiveGame();
    error KillsOutOfBounds();
    error TimeOutOfBounds();
    error SessionExpired();
    error GameOverProofRequired();
    error InvalidProof();
    error InvalidSkinId();
    error MaxSkinLevel();
    error MaxWeaponLevel();
    error InsufficientGold();
    error InsufficientDiamond();
    error UnknownItem();
    error UnsupportedPriceType();
    error NoLotteryYet();
    error ZeroAddress();
    error NativeTransferFailed();
    error NothingToClaim();
    error RescueExceedsBalance();

    // 0: Gold; 1: Diamond;
    struct PriceItem {
        uint256 priceType;
        uint256 price;
    }

    struct MessageItem {
        address player;
        uint256 time;
        uint256 kills;
    }

    // 0: Gold; 1: Diamond; 2: skin; 3: Weapon
    struct LotteryItem {
        uint256 itemType;
        uint256 num;
    }

    struct GameLog {
        uint256 startTime;
        uint256 endTime;
        address player;
        uint256 reLive;
        uint256 grade;
    }

    event RequestLottery(
        uint256 requestId,
        uint256 random,
        LotteryItem lotteryItem
    );

    event GameLogEvent(
        uint256 startTime,
        uint256 endTime,
        address player,
        uint256 grade,
        uint256 reLive
    );

    /// @dev Emitted when the reactivity handler processes a GameLogEvent (from this or another game contract).
    event ReactedToGameLog(address indexed emitter, address indexed player, uint256 grade);

    /// @dev Number of times the Somnia reactivity handler has been invoked (for analytics / debugging).
    uint256 public reactivityInvocationCount;

    // Lottery
    uint256 public totalLotteryTimes;
    LotteryItem[] public LotteryItemList;
    mapping(address => uint256) public playerLastlotteryResultIndexMap;
    /// @dev Number of completed lottery draws per player; `0` means `getPlayerLastLotteryResult` is undefined.
    mapping(address => uint256) public playerLotteryDrawCount;

    // player's weapon / skin (enumeration arrays + O(1) ownership flags)
    mapping(address => uint256[]) public playerWeaponMap;
    mapping(address => mapping(uint256 => uint256)) public playerWeaponLevelMap;
    mapping(address => uint256[]) public playerSkinMap;
    mapping(address => mapping(uint256 => uint256)) public playerSkinLevelMap;
    mapping(address => mapping(uint256 => bool)) public playerHasWeapon;
    mapping(address => mapping(uint256 => bool)) public playerHasSkin;

    mapping(address => uint256) public playerGoldMap;
    mapping(address => uint256) public playerDiamondMap;

    /// @dev Leaderboard: `topKillsList` stores kill counts (higher is better). `topSurvivalTimeList` stores survival time for that run.
    uint256[10] public topKillsList;
    uint256[10] public topSurvivalTimeList;
    address[10] public topPlayerList;
    bytes32[10] public topPlayerChainHashList;
    uint256 public lastUpdateTime;

    /// @notice Native STT owed to a player (rank #1 rewards, etc.); claim via `claimNativeRewards`.
    mapping(address => uint256) public claimableNative;

    /// @notice Optional UltraHonk verifier for `gameOverWithProof` (address(0) = verification disabled).
    address public gameOverVerifier;

    event GameOverVerifierSet(address indexed verifier);

    mapping(address => uint256) public playerLatestGameLogIdMap;
    mapping(uint256 => GameLog) public gameLogMap;
    uint256 public totalGame;

    mapping(uint256 => PriceItem) public weaponPriceMap;
    uint256[] public weaponLevelPriceList;
    mapping(uint256 => PriceItem) public skinPriceMap;
    uint256[] public skinLevelPriceList;

    constructor() Ownable(msg.sender) {
        _initWeaponAndSkinData();
        _initLotteryList();
    }

    function _initWeaponAndSkinData() private {
        weaponPriceMap[0] = PriceItem(0, 0);
        weaponPriceMap[1] = PriceItem(0, 1000);
        weaponPriceMap[5] = PriceItem(0, 1500);
        weaponPriceMap[6] = PriceItem(0, 2000);
        weaponPriceMap[7] = PriceItem(0, 500);
        weaponPriceMap[8] = PriceItem(0, 5000);
        weaponPriceMap[9] = PriceItem(1, 500);
        weaponPriceMap[15] = PriceItem(1, 500);
        weaponPriceMap[16] = PriceItem(0, 3000);
        weaponPriceMap[18] = PriceItem(1, 1000);

        skinPriceMap[0] = PriceItem(0, 0);
        skinPriceMap[1] = PriceItem(0, 1000);
        skinPriceMap[2] = PriceItem(0, 2500);
        skinPriceMap[3] = PriceItem(1, 1000);

        weaponLevelPriceList.push(0);
        weaponLevelPriceList.push(100);
        weaponLevelPriceList.push(300);
        weaponLevelPriceList.push(600);

        skinLevelPriceList.push(0);
        skinLevelPriceList.push(100);
        skinLevelPriceList.push(200);
        skinLevelPriceList.push(300);
        skinLevelPriceList.push(400);
        skinLevelPriceList.push(500);
        skinLevelPriceList.push(600);
    }

    function _initLotteryList() private {
        LotteryItemList.push(LotteryItem(1, 10));
        LotteryItemList.push(LotteryItem(0, 50));
        LotteryItemList.push(LotteryItem(0, 150));
        LotteryItemList.push(LotteryItem(3, 18));
        LotteryItemList.push(LotteryItem(0, 200));
        LotteryItemList.push(LotteryItem(1, 20));
        LotteryItemList.push(LotteryItem(2, 1));
        LotteryItemList.push(LotteryItem(3, 9));
    }

    /// @dev Send native token with full gas forwarded (smart-wallet safe). CEI: use only after state updates when needed.
    function _sendValue(address payable to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
    }

    function _currentTopPlayer() internal view returns (address) {
        return topPlayerList[0];
    }

    /// @dev Credits the current #1 player; if none is set, native remains in the contract (see `rescueNative`).
    function _accrueToLeader(uint256 amount) internal {
        if (amount == 0) return;
        address top = _currentTopPlayer();
        if (top != address(0)) {
            claimableNative[top] += amount;
        }
    }

    /// @notice Pull-based payout for leaderboard rewards (and similar). Reentrancy-safe.
    function claimNativeRewards() external nonReentrant {
        uint256 amt = claimableNative[msg.sender];
        if (amt == 0) revert NothingToClaim();
        claimableNative[msg.sender] = 0;
        _sendValue(payable(msg.sender), amt);
    }

    /// @notice Emergency native recovery; does not reconcile `claimableNative` — use only with care (e.g. testnet).
    function rescueNative(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > address(this).balance) revert RescueExceedsBalance();
        _sendValue(to, amount);
    }

    function setGameOverVerifier(address v) external onlyOwner {
        gameOverVerifier = v;
        emit GameOverVerifierSet(v);
    }

    /// @dev Grant skin from lottery: new skin unlock, or +1 level if already owned (capped).
    function _grantLotterySkin(address player, uint256 skinId) internal {
        if (!(skinPriceMap[skinId].price > 0 || skinId == 0)) revert InvalidSkinId();
        if (playerHasSkin[player][skinId]) {
            uint256 lv = playerSkinLevelMap[player][skinId];
            if (lv < skinLevelPriceList.length - 1) {
                playerSkinLevelMap[player][skinId]++;
            }
        } else {
            playerSkinMap[player].push(skinId);
            playerHasSkin[player][skinId] = true;
        }
    }

    function _enforceGameOverScores(uint256 time, uint256 kills, uint256 logId) internal view {
        if (gameLogMap[logId].startTime == 0) revert NoActiveGame();
        if (kills > 1_000_000_000) revert KillsOutOfBounds();
        if (time > 1_000_000_000_000) revert TimeOutOfBounds();
        if (block.timestamp - gameLogMap[logId].startTime > 7 days) revert SessionExpired();
    }

    function _finalizeGameOver(uint256 logId, uint256 time, uint256 kills) internal {
        gameLogMap[logId].endTime = block.timestamp;
        gameLogMap[logId].grade = time;
        pushDataToTopList(MessageItem(msg.sender, time, kills));

        if (kills > 0) {
            playerGoldMap[msg.sender] += kills;
        }

        emit GameLogEvent(
            gameLogMap[logId].startTime,
            gameLogMap[logId].endTime,
            gameLogMap[logId].player,
            time,
            gameLogMap[logId].reLive
        );
    }

    /// @dev Accrue fixed ticket to leader, refund any overpayment to the payer.
    function _takeTicketAccrueLeaderRefundExcess(uint256 ticket) internal {
        if (msg.value < ticket) revert InsufficientValue();
        _accrueToLeader(ticket);
        uint256 excess = msg.value - ticket;
        if (excess > 0) {
            _sendValue(payable(msg.sender), excess);
        }
    }

    function startGame() external payable nonReentrant {
        uint256 ticket = 10 ** 16; // 0.01 STT
        _takeTicketAccrueLeaderRefundExcess(ticket);

        playerLatestGameLogIdMap[msg.sender] = totalGame;
        gameLogMap[totalGame].startTime = block.timestamp;
        gameLogMap[totalGame].player = msg.sender;
        unchecked {
            totalGame++;
        }
    }

    function reLive() external payable nonReentrant {
        uint256 ticket = 5 * 10 ** 16; // 0.05 STT
        _takeTicketAccrueLeaderRefundExcess(ticket);
    }

    function getPlayerAllWeaponInfo(address player) external view returns (uint256[] memory weaponIdList, uint256[] memory weaponLevelList) {
        weaponIdList = playerWeaponMap[player];
        weaponLevelList = new uint256[](weaponIdList.length);
        for (uint256 i = 0; i < weaponIdList.length; i++) {
            weaponLevelList[i] = playerWeaponLevelMap[player][weaponIdList[i]];
        }
        return (weaponIdList, weaponLevelList);
    }

    function getPlayerAllSkinInfo(address player) external view returns (uint256[] memory skinIdList, uint256[] memory skinLevelList) {
        skinIdList = playerSkinMap[player];
        skinLevelList = new uint256[](skinIdList.length);
        for (uint256 i = 0; i < skinIdList.length; i++) {
            skinLevelList[i] = playerSkinLevelMap[player][skinIdList[i]];
        }
        return (skinIdList, skinLevelList);
    }

    /// @dev Shared buy/upgrade path for skins and weapons (`isSkin == true` → skin catalog).
    function _buyOrUpgradeCatalog(bool isSkin, uint256 id) private {
        mapping(uint256 => PriceItem) storage priceMap = isSkin ? skinPriceMap : weaponPriceMap;
        uint256[] storage levelPrices = isSkin ? skinLevelPriceList : weaponLevelPriceList;
        mapping(address => mapping(uint256 => uint256)) storage levelMap = isSkin ? playerSkinLevelMap : playerWeaponLevelMap;
        mapping(address => uint256[]) storage idList = isSkin ? playerSkinMap : playerWeaponMap;
        mapping(address => mapping(uint256 => bool)) storage hasMap = isSkin ? playerHasSkin : playerHasWeapon;

        bool owns = (id == 0) || hasMap[msg.sender][id];

        if (owns) {
            uint256 currentLevel = levelMap[msg.sender][id];
            if (currentLevel >= levelPrices.length - 1) {
                if (isSkin) revert MaxSkinLevel();
                else revert MaxWeaponLevel();
            }
            uint256 goldPrice = levelPrices[currentLevel + 1];
            if (playerGoldMap[msg.sender] < goldPrice) revert InsufficientGold();
            playerGoldMap[msg.sender] -= goldPrice;
            levelMap[msg.sender][id]++;
        } else {
            PriceItem memory priceItem = priceMap[id];
            if (priceItem.price == 0 && id != 0) revert UnknownItem();
            if (priceItem.priceType == 0) {
                if (playerGoldMap[msg.sender] < priceItem.price) revert InsufficientGold();
                playerGoldMap[msg.sender] -= priceItem.price;
                idList[msg.sender].push(id);
                hasMap[msg.sender][id] = true;
            } else if (priceItem.priceType == 1) {
                if (playerDiamondMap[msg.sender] < priceItem.price) revert InsufficientDiamond();
                playerDiamondMap[msg.sender] -= priceItem.price;
                idList[msg.sender].push(id);
                hasMap[msg.sender][id] = true;
            } else {
                revert UnsupportedPriceType();
            }
        }
    }

    function buyOrUpgradeSkin(uint256 id) external {
        _buyOrUpgradeCatalog(true, id);
    }

    function buyOrUpgradeWeapon(uint256 id) external {
        _buyOrUpgradeCatalog(false, id);
    }

    function mintGold() external payable nonReentrant {
        uint256 ticket = 10 ** 16; // 0.01 STT
        if (msg.value < ticket) revert InsufficientValue();
        playerGoldMap[msg.sender] += 500;
        _accrueToLeader(msg.value);
    }

    // --- Lottery entropy (explicitly NOT an oracle VRF) -------------------------------------------

    function _lotteryEntropyWord(address player, uint256 salt) internal view returns (uint256) {
        return uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    block.timestamp,
                    block.number,
                    player,
                    salt,
                    address(this)
                )
            )
        );
    }

    /// @notice Preview the pseudorandom word used for lottery mixing for a given `player` and `salt`.
    /// @dev Matches `_lotteryEntropyWord`. For the next on-chain draw, `salt` is `totalLotteryTimes + 1`
    ///      (the value **after** the increment performed inside `requestLottery`).
    function previewLotteryEntropyWord(address player, uint256 salt) external view returns (uint256) {
        return _lotteryEntropyWord(player, salt);
    }

    function requestLottery() external payable nonReentrant {
        uint256 ticket = 4 * 10 ** 16; // 0.04 STT
        if (msg.value < ticket) revert InsufficientValue();

        unchecked {
            totalLotteryTimes++;
        }

        uint256 random = _lotteryEntropyWord(msg.sender, totalLotteryTimes);

        uint256 len = LotteryItemList.length;
        uint256 index = random % len;
        LotteryItem memory item = LotteryItemList[index];

        playerLastlotteryResultIndexMap[msg.sender] = index;
        unchecked {
            playerLotteryDrawCount[msg.sender]++;
        }

        if (item.itemType == 0) {
            playerGoldMap[msg.sender] += item.num;
        } else if (item.itemType == 1) {
            playerDiamondMap[msg.sender] += item.num;
        } else if (item.itemType == 2) {
            _grantLotterySkin(msg.sender, item.num);
        } else if (item.itemType == 3) {
            playerWeaponMap[msg.sender].push(item.num);
            playerHasWeapon[msg.sender][item.num] = true;
        }

        emit RequestLottery(totalLotteryTimes, random, item);

        _accrueToLeader(msg.value);
    }

    function getPlayerLastLotteryResult(address player) external view returns (uint256 itemType, uint256 num) {
        if (playerLotteryDrawCount[player] == 0) revert NoLotteryYet();
        uint256 index = playerLastlotteryResultIndexMap[player];
        LotteryItem memory item = LotteryItemList[index];
        return (item.itemType, item.num);
    }

    function getPlayerAllAssets(address player) external view returns (uint256 gold, uint256 diamond) {
        return (playerGoldMap[player], playerDiamondMap[player]);
    }

    /// @notice Submit a run without SNARK verification **only while** `gameOverVerifier` is unset.
    function gameOver(uint256 time, uint256 kills) external {
        if (gameOverVerifier != address(0)) revert GameOverProofRequired();
        uint256 logId = playerLatestGameLogIdMap[msg.sender];
        if (gameLogMap[logId].player != msg.sender) revert NotGamePlayer();
        _enforceGameOverScores(time, kills, logId);
        _finalizeGameOver(logId, time, kills);
    }

    /// @notice Verified game-over path; when `gameOverVerifier` is set, proof must verify.
    function gameOverWithProof(uint256 time, uint256 kills, bytes calldata proof) external {
        uint256 logId = playerLatestGameLogIdMap[msg.sender];
        if (gameLogMap[logId].player != msg.sender) revert NotGamePlayer();
        _enforceGameOverScores(time, kills, logId);

        if (gameOverVerifier != address(0)) {
            bytes32[] memory pub = new bytes32[](4);
            pub[0] = bytes32(uint256(uint160(msg.sender)));
            pub[1] = bytes32(logId);
            pub[2] = bytes32(time);
            pub[3] = bytes32(kills);
            if (!IUltraVerifier(gameOverVerifier).verify(proof, pub)) revert InvalidProof();
        }

        _finalizeGameOver(logId, time, kills);
    }

    /// @dev Binary search insert by kills; `topSurvivalTimeList` stores the survival `time` for that row.
    function pushDataToTopList(MessageItem memory messageItem) internal {
        uint256 time = messageItem.time;
        uint256 kills = messageItem.kills;
        address player = messageItem.player;

        bytes32 chainHash = "STT";
        if (topKillsList[topKillsList.length - 1] < kills) {
            uint256 left = 0;
            uint256 right = topKillsList.length - 1;
            uint256 mid;

            while (left < right) {
                mid = (left + right) / 2;
                if (topKillsList[mid] < kills) {
                    right = mid;
                } else {
                    left = mid + 1;
                }
            }

            for (uint256 i = topKillsList.length - 1; i > left; i--) {
                topKillsList[i] = topKillsList[i - 1];
                topSurvivalTimeList[i] = topSurvivalTimeList[i - 1];
                topPlayerList[i] = topPlayerList[i - 1];
                topPlayerChainHashList[i] = topPlayerChainHashList[i - 1];
            }
            topKillsList[left] = kills;
            topSurvivalTimeList[left] = time;
            topPlayerList[left] = player;
            topPlayerChainHashList[left] = chainHash;
        }

        lastUpdateTime = block.timestamp;
    }

    function getTopListInfo()
        public
        view
        returns (uint256[10] memory, uint256[10] memory, address[10] memory, bytes32[10] memory, uint256)
    {
        return (topKillsList, topSurvivalTimeList, topPlayerList, topPlayerChainHashList, lastUpdateTime);
    }

    /// @notice Somnia reactivity: called by the chain when a subscribed event matches (e.g. GameLogEvent).
    function _onEvent(
        address emitter,
        bytes32[] calldata /* eventTopics */,
        bytes calldata data
    ) internal override {
        reactivityInvocationCount += 1;

        if (data.length >= 32 * 5) {
            (, , address player, uint256 grade, uint256 reLive) =
                abi.decode(data, (uint256, uint256, address, uint256, uint256));
            emit ReactedToGameLog(emitter, player, grade);
        }
    }
}


