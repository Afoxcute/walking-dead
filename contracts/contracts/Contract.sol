// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";

// Universal Account ID Struct and IUEAFactory Interface
struct UniversalAccountId {
    string chainNamespace;
    string chainId;
    bytes owner;
}

interface IUEAFactory {
    function getOriginForUEA(address addr) external view returns (UniversalAccountId memory account, bool isUEA);
}

interface IOwnable {
    /// @dev Returns the owner of the contract.
    function owner() external view returns (address);

    /// @dev Lets a module admin set a new owner for the contract. The new owner must be a module admin.
    function setOwner(address _newOwner) external;

    /// @dev Emitted when a new Owner is set.
    event OwnerUpdated(address indexed prevOwner, address indexed newOwner);
}

abstract contract Ownable is IOwnable {
    /// @dev The sender is not authorized to perform the action
    error OwnableUnauthorized();

    /// @dev Owner of the contract (purpose: OpenSea compatibility)
    address private _owner;

    /// @dev Reverts if caller is not the owner.
    modifier onlyOwner() {
        if (msg.sender != _owner) {
            revert OwnableUnauthorized();
        }
        _;
    }

    /**
     *  @notice Returns the owner of the contract.
     */
    function owner() public view override returns (address) {
        return _owner;
    }

    /**
     *  @notice Lets an authorized wallet set a new owner for the contract.
     *  @param _newOwner The address to set as the new owner of the contract.
     */
    function setOwner(address _newOwner) external override {
        if (!_canSetOwner()) {
            revert OwnableUnauthorized();
        }
        _setupOwner(_newOwner);
    }

    /// @dev Lets a contract admin set a new owner for the contract. The new owner must be a contract admin.
    function _setupOwner(address _newOwner) internal {
        address _prevOwner = _owner;
        _owner = _newOwner;

        emit OwnerUpdated(_prevOwner, _newOwner);
    }

    /// @dev Returns whether owner can be set in the given execution context.
    function _canSetOwner() internal view virtual returns (bool);
}

interface IUltraVerifier {
    function getVerificationKeyHash() external pure returns (bytes32);

    function verify(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external view returns (bool);
}

contract ZKGameClient is Ownable, SomniaEventHandler {
    // 0: Gold; 1: Diamond;
    struct PriceItem {
        uint priceType;
        uint price;
    }

    struct MessageItem {
        address player;
        uint time;
        uint kills;
    }

    // 0: Gold; 1: Diamond; 2: skin; 3: Weapon
    struct LotteryItem {
        uint itemType;
        uint num;
    }

    struct GameLog{
        uint startTime;
        uint endTime;
        address player;
        uint reLive;
        uint grade;
    }

    event RequestLottery(
        uint256 requestId,
        uint256 random,
        LotteryItem lotteryItem
    );

    event GameLogEvent(
        uint startTime,
        uint endTime,
        address player,
        uint grade,
        uint reLive
    );

    /// @dev Emitted when the reactivity handler processes a GameLogEvent (from this or another game contract).
    event ReactedToGameLog(address indexed emitter, address indexed player, uint256 grade);

    /// @dev Number of times the Somnia reactivity handler has been invoked (for analytics / debugging).
    uint256 public reactivityInvocationCount;

    // Lottery
    uint256 public totalLotteryTimes = 0;
    LotteryItem[] public LotteryItemList;
    mapping(address => uint256) public playerLastlotteryResultIndexMap; /*  address --> requestId */

    // player's weapon
    mapping(address => uint[]) public playerWeaponMap; /* player --> uint[] */
    mapping(address => mapping(uint=>uint)) public playerWeaponLevelMap; /* player --> id ->level*/
    mapping(address => uint[]) public playerSkinMap; /* player --> uint[] */
    mapping(address => mapping(uint=>uint)) public playerSkinLevelMap; /* player --> id ->level*/
    mapping(address => uint) public playerGoldMap; /* player --> uint */
    mapping(address => uint) public playerDiamondMap; /* player --> uint */

    /// topList
    uint[10] public topGradeList; // Top 10 grade List, kills
    uint[10] public topTimeList; // Top 10 grade List, timestamp
    address[10] public topPlayerList; // Top 10 player List, address
    bytes32[10] public topPlayerChainHashList; // Top 10 player chainHash List, bytes32
    uint public lastUpdateTime; // last update time of topList

    /// @notice Optional UltraHonk verifier for `gameOverWithProof` (address(0) = verification disabled).
    address public gameOverVerifier;

    event GameOverVerifierSet(address indexed verifier);

    /// log
    mapping(address => uint) public playerLatestGameLogIdMap; // id => GameLog
    mapping(uint => GameLog) public gameLogMap; // id => GameLog
    uint public totalGame = 0;

    // weapon upgrade
    mapping(uint => PriceItem) public weaponPriceMap; // id => price
    uint[] public weaponLevelPriceList;
    // skin upgrade
    mapping(uint => PriceItem) public skinPriceMap; // id => price
    uint[] public skinLevelPriceList;

    constructor(){
        _setupOwner(msg.sender);
        initWeaponAndSkinData();
        initLotteryList();
    }

    function initWeaponAndSkinData() public onlyOwner {
        // weapon price
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

        // skin price
        skinPriceMap[0] = PriceItem(0, 0);
        skinPriceMap[1] = PriceItem(0, 1000);
        skinPriceMap[2] = PriceItem(0, 2500);
        skinPriceMap[3] = PriceItem(1, 1000);

        // weapon leavel price (glod)
        weaponLevelPriceList.push(0); // new weapon
        weaponLevelPriceList.push(100);
        weaponLevelPriceList.push(300);
        weaponLevelPriceList.push(600);
                
        // skin leavel price (glod)
        skinLevelPriceList.push(0); // new skin
        skinLevelPriceList.push(100);
        skinLevelPriceList.push(200);
        skinLevelPriceList.push(300);
        skinLevelPriceList.push(400);
        skinLevelPriceList.push(500);
        skinLevelPriceList.push(600);
    }

    // lottery
    function initLotteryList() public onlyOwner {
        // LotteryItemList.push(LotteryItem(0,100));
        // LotteryItemList.push(LotteryItem(0,50));
        LotteryItemList.push(LotteryItem(1,10));
        LotteryItemList.push(LotteryItem(0,50));
        LotteryItemList.push(LotteryItem(0,150));
        LotteryItemList.push(LotteryItem(3,18));
        LotteryItemList.push(LotteryItem(0,200));
        // LotteryItemList.push(LotteryItem(0,50));
        LotteryItemList.push(LotteryItem(1,20));
        LotteryItemList.push(LotteryItem(2,1));
        // LotteryItemList.push(LotteryItem(0,200));
        LotteryItemList.push(LotteryItem(3,9));
    }

    function distribution(address payable winner, uint amount) internal {
        winner.transfer(amount);
    }

    function setGameOverVerifier(address v) external onlyOwner {
        gameOverVerifier = v;
        emit GameOverVerifierSet(v);
    }

    /// @dev Grant skin from lottery: new skin unlock, or +1 level if already owned (capped).
    function _grantLotterySkin(address player, uint skinId) internal {
        require(skinPriceMap[skinId].price > 0 || skinId == 0, "Invalid skin id");
        uint[] storage owned = playerSkinMap[player];
        bool found = false;
        for (uint i = 0; i < owned.length; i++) {
            if (owned[i] == skinId) {
                found = true;
                break;
            }
        }
        if (!found) {
            playerSkinMap[player].push(skinId);
        } else {
            uint lv = playerSkinLevelMap[player][skinId];
            if (lv < skinLevelPriceList.length - 1) {
                playerSkinLevelMap[player][skinId]++;
            }
        }
    }

    /// @dev Bounds and session window; full trustlessness needs a circuit + `gameOverWithProof`.
    function _enforceGameOverScores(uint time, uint kills, uint logId) internal view {
        require(gameLogMap[logId].startTime > 0, "no game");
        require(kills <= 1_000_000_000, "kills OOB");
        require(time <= 1_000_000_000_000, "score OOB");
        require(block.timestamp - gameLogMap[logId].startTime <= 7 days, "session expired");
    }

    function _finalizeGameOver(uint logId, uint time, uint kills) internal {
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

    function startGame() public payable {
        // pay gas token
        uint gasTokenAmountToPay = 10**16; // 0.01 STT
        require(msg.value >= gasTokenAmountToPay,"Gas Token is not enough!");

        // save log
        playerLatestGameLogIdMap[msg.sender] = totalGame;
        gameLogMap[totalGame].startTime = block.timestamp;
        gameLogMap[totalGame].player = msg.sender;
        totalGame = totalGame + 1;

        // distribution
        address payable top1Player = payable(topPlayerList[0]);
        uint balance = address(this).balance;
        if(balance >0 && top1Player != address(0)) {
            distribution(top1Player, balance);
        }
    }

    function reLive() public payable {
        // pay gas token
        uint gasTokenAmountToPay = 5*10**16; // 0.05 STT
        require(msg.value >= gasTokenAmountToPay,"Gas Token is not enough!");

        // distribution
        address payable top1Player = payable(topPlayerList[0]);
        uint balance = address(this).balance;
        if(balance >0 && top1Player != address(0)) {
            distribution(top1Player, balance);
        }
    }

    function testWeaponSkin() external onlyOwner {
        playerWeaponMap[msg.sender].push(5);
        playerWeaponMap[msg.sender].push(15);
        playerSkinMap[msg.sender].push(2);
        playerGoldMap[msg.sender] = 999999;
        playerDiamondMap[msg.sender] = 999999;
    }

    function getPlayerAllWeaponInfo(address player) external view returns(uint[] memory weaponIdList, uint[] memory weaponLevelList) {
        weaponIdList = playerWeaponMap[player];
        weaponLevelList = new uint[](weaponIdList.length);
        for(uint i=0; i < weaponIdList.length; i++) {
            weaponLevelList[i] = playerWeaponLevelMap[player][weaponIdList[i]];
        }
        return (weaponIdList, weaponLevelList);
    }

    function getPlayerAllSkinInfo(address player) external view returns(uint[] memory skinIdList, uint[] memory skinLevelList) {
        skinIdList = playerSkinMap[player];
        skinLevelList = new uint[](skinIdList.length);
        for(uint i=0; i < skinIdList.length; i++) {
            skinLevelList[i] = playerSkinLevelMap[player][skinIdList[i]];
        }
        return (skinIdList, skinLevelList);
    }

    function buyOrUpgradeSkin(uint id) external {
        uint[] memory skinList = playerSkinMap[msg.sender];
        bool found = false;
        for(uint i=0; i<skinList.length; i++) {
            if(skinList[i] == id) {
                found = true;
            }
        }
        if(found || id == 0) {
            // upgrade
            uint currentLevel = playerSkinLevelMap[msg.sender][id];
            require(currentLevel < skinLevelPriceList.length -1, "Your skin is reached the highest level");
            uint goldPrice = skinLevelPriceList[currentLevel+1];
            uint goldNum = playerGoldMap[msg.sender];
            require(goldNum >= goldPrice, 'Your gold is not enough!');
            playerGoldMap[msg.sender] -= goldPrice;
            playerSkinLevelMap[msg.sender][id]++;
        } else {
            // buy
            PriceItem memory priceItem = skinPriceMap[id];
            if(priceItem.priceType == 0) {
                uint goldNum = playerGoldMap[msg.sender];
                require(goldNum >= priceItem.price, 'Your gold is not enough!');
                playerGoldMap[msg.sender] -= priceItem.price;
                playerSkinMap[msg.sender].push(id);
            } else if(priceItem.priceType == 1) {
                uint diamondNum =  playerDiamondMap[msg.sender];
                require(diamondNum >= priceItem.price, 'Your diamond is not enough!');
                playerDiamondMap[msg.sender] -= priceItem.price;
                playerSkinMap[msg.sender].push(id);
            }
        }
    }

    function buyOrUpgradeWeapon(uint id) external {
        uint[] memory weaponList = playerWeaponMap[msg.sender];
        bool found = false;
        for(uint i=0; i<weaponList.length; i++) {
            if(weaponList[i] == id) {
                found = true;
            }
        }
        if(found || id == 0) {
            // upgrade
            uint currentLevel = playerWeaponLevelMap[msg.sender][id];
            require(currentLevel < weaponLevelPriceList.length -1, "Your weapon is reached the highest level");
            uint goldPrice = weaponLevelPriceList[currentLevel+1];
            uint goldNum = playerGoldMap[msg.sender];
            require(goldNum >= goldPrice, 'Your gold is not enough!');
            playerGoldMap[msg.sender] -= goldPrice;
            playerWeaponLevelMap[msg.sender][id]++;
        } else {
            // buy
            PriceItem memory priceItem = weaponPriceMap[id];
            if(priceItem.priceType == 0) {
                uint goldNum = playerGoldMap[msg.sender];
                require(goldNum >= priceItem.price, 'Your gold is not enough!');
                playerGoldMap[msg.sender] -= priceItem.price;
                playerWeaponMap[msg.sender].push(id);
            } else if(priceItem.priceType == 1) {
                uint diamondNum =  playerDiamondMap[msg.sender];
                require(diamondNum >= priceItem.price, 'Your diamond is not enough!');
                playerDiamondMap[msg.sender] -= priceItem.price;
                playerWeaponMap[msg.sender].push(id);
            }
        }
    }

    function mintGold()  external payable {
        // pay gas token
        uint gasTokenAmountToPay = 10**16; // 0.01 STT
        require(msg.value >= gasTokenAmountToPay,"Gas Token is not enough!");
        playerGoldMap[msg.sender] += 500;
    }

    // random number generator
    function VRF(uint256 salt) public view returns (uint256) {
        return salt + block.timestamp;
    }

    // lottery
    function requestLottery() external payable {
        // pay gas token
        uint gasTokenAmountToPay = 4*10**16; // 0.04 STT
        require(msg.value >= gasTokenAmountToPay,"Gas Token is not enough!");

        totalLotteryTimes = totalLotteryTimes + 1;

        // get random from VRF
        uint256 random = VRF(totalLotteryTimes);

        // get lottery reault
        uint len = LotteryItemList.length;
        uint index = random % len;
        LotteryItem memory item = LotteryItemList[index];

        playerLastlotteryResultIndexMap[msg.sender] = index;

        // distribution rewards
        if(item.itemType == 0) {
            // mint gold
            playerGoldMap[msg.sender] += item.num;
        } else if(item.itemType == 1) {
            // mint diamond
            playerDiamondMap[msg.sender] += item.num;
        } else if(item.itemType == 2) {
            _grantLotterySkin(msg.sender, item.num);
        } else if(item.itemType == 3) {
            // mint weapon
            playerWeaponMap[msg.sender].push(item.num);
        }

        emit RequestLottery(
            totalLotteryTimes,
            random,
            item
        );
    }

    // lottery
    function getPlayerLastLotteryResult(address player) external view returns (uint itemType,uint num) {
        uint256 index = playerLastlotteryResultIndexMap[player];
        LotteryItem memory item = LotteryItemList[index];
        return (item.itemType, item.num);
    }


    // player info
    function getPlayerAllAssets(address player) external view returns(uint gold,uint diamond) {
        return (playerGoldMap[player], playerDiamondMap[player]);
    }

    /// @notice Submit a run without SNARK verification (compatible with existing clients).
    function gameOver(uint time, uint kills) external {
        uint logId = playerLatestGameLogIdMap[msg.sender];
        require(gameLogMap[logId].player == msg.sender, "Call startGame first");
        _enforceGameOverScores(time, kills, logId);
        _finalizeGameOver(logId, time, kills);
    }

    /// @notice Same as `gameOver` but verifies `proof` when `gameOverVerifier` is set (UltraHonk-style verifier).
    /// @dev Public inputs are fixed layout: [bytes32(uint160(player)), bytes32(logId), bytes32(time), bytes32(kills)] — must match your circuit.
    function gameOverWithProof(uint time, uint kills, bytes calldata proof) external {
        uint logId = playerLatestGameLogIdMap[msg.sender];
        require(gameLogMap[logId].player == msg.sender, "Call startGame first");
        _enforceGameOverScores(time, kills, logId);

        if (gameOverVerifier != address(0)) {
            bytes32[] memory pub = new bytes32[](4);
            pub[0] = bytes32(uint256(uint160(msg.sender)));
            pub[1] = bytes32(logId);
            pub[2] = bytes32(time);
            pub[3] = bytes32(kills);
            require(IUltraVerifier(gameOverVerifier).verify(proof, pub), "Invalid proof");
        }

        _finalizeGameOver(logId, time, kills);
    }

    /// Use binary search algorithm
    function pushDataToTopList(MessageItem memory messageItem) internal {
        uint time = messageItem.time;
        uint kills = messageItem.kills;
        address player = messageItem.player;

        // Use default chain hash (e.g. Somnia/STT). Skip UEA lookup at 0xea to avoid reverts
        // on chains where 0xea is missing or returns incompatible data.
        bytes32 chainHash = "STT";
        if (topGradeList[topGradeList.length -1] < kills) {
            uint left = 0;
            uint right = topGradeList.length - 1;
            uint mid;

            while (left < right) {
                mid = (left + right) / 2;
                if (topGradeList[mid] < kills) {
                    right = mid;
                } else {
                    left = mid + 1;
                }
            }

            for(uint i = topGradeList.length - 1; i > left; i--) {
                topGradeList[i] = topGradeList[i - 1];
                topTimeList[i] = topTimeList[i - 1];
                topPlayerList[i] = topPlayerList[i - 1];
                topPlayerChainHashList[i] = topPlayerChainHashList[i - 1];
            }
            topGradeList[left] = kills;
            topTimeList[left] = time;
            topPlayerList[left] = player;
            topPlayerChainHashList[left] = chainHash;
        }

        lastUpdateTime = block.timestamp;
    }

    function getTopListInfo() public view returns (uint[10] memory , uint[10] memory, address[10] memory, bytes32[10] memory, uint) {
        return (topGradeList, topTimeList, topPlayerList, topPlayerChainHashList, lastUpdateTime);
    }

    /// @notice Somnia reactivity: called by the chain when a subscribed event matches (e.g. GameLogEvent).
    /// @param emitter Address of the contract that emitted the event.
    /// @param data ABI-encoded non-indexed event parameters.
    function _onEvent(
        address emitter,
        bytes32[] calldata /* eventTopics */,
        bytes calldata data
    ) internal override {
        reactivityInvocationCount += 1;

        // Only react to GameLogEvent-shaped payloads (same as this contract's GameLogEvent).
        // GameLogEvent(uint256,uint256,address,uint256,uint256) - all non-indexed, so full decode from data.
        if (data.length >= 32 * 5) {
            (, , address player, uint256 grade, ) =
                abi.decode(data, (uint256, uint256, address, uint256, uint256));
            // Avoid reentrancy: do not call back into game logic; only emit a separate event.
            emit ReactedToGameLog(emitter, player, grade);
        }
    }

    function _canSetOwner() internal virtual view override returns (bool) {
        return msg.sender == owner();
    }
}