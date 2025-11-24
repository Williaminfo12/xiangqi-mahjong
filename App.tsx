import React, { useState, useEffect, useRef } from 'react';
import { 
  GamePhase, 
  GameState, 
  Player, 
  TileData,
  GameMode,
  NetworkMessage,
  NetworkActionType
} from './types';
import { 
  generateDeck, 
  PLAYER_NAMES, 
  AVATARS 
} from './constants';
import { 
  shuffleDeck, 
  sortHand, 
  checkWin, 
  checkWinWithTile,
  getBestDiscard,
  getChiCombinations,
  isFivePawns
} from './utils/gameLogic';
import Tile from './components/Tile';
import Wall from './components/Wall';
import multiplayerService from './services/multiplayerService';
import audioService from './services/audioService';

const App: React.FC = () => {
  // --- State ---
  const [game, setGame] = useState<GameState>({
    mode: GameMode.SINGLEPLAYER,
    phase: GamePhase.LOBBY,
    playerCount: 4,
    turnIndex: 0,
    dealerIndex: 0,
    wall: [],
    wallBreakIndex: 0,
    players: [],
    lastDiscard: null,
    winnerId: null,
    loserId: null,
    winningHand: null,
    logs: ["歡迎來到臺灣象棋麻將！"],
  });

  // Multiplayer State
  const [myPlayerId, setMyPlayerId] = useState<number>(0); 
  const [isHost, setIsHost] = useState<boolean>(true);
  const [showLobby, setShowLobby] = useState(true);
  const [roomId, setRoomId] = useState<string>(""); 
  
  // Inputs
  const [playerNameInput, setPlayerNameInput] = useState<string>("玩家");
  const [joinInput, setJoinInput] = useState<string>("");
  const [createRoomIdInput, setCreateRoomIdInput] = useState<string>(""); 

  const [isConnecting, setIsConnecting] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");
  const [selectedPlayerCount, setSelectedPlayerCount] = useState<number>(4);

  const [isProcessing, setIsProcessing] = useState(false); 
  const [winningTile, setWinningTile] = useState<TileData | null>(null); 
  const [waitingReason, setWaitingReason] = useState<'NONE' | 'HU' | 'TURN_DECISION'>('NONE');
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null); 
  const [decisionTimer, setDecisionTimer] = useState(0);
  const [nextRoundDealer, setNextRoundDealer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  // --- Initialization ---

  const initGame = (mode: GameMode, myId: number, count: number, myName: string = "玩家") => {
    audioService.playBGM();
    const isMultiplayer = mode === GameMode.MULTIPLAYER;
    const host = isMultiplayer ? myId === 0 : true;

    const players: Player[] = Array.from({ length: count }).map((_, i) => ({
      id: i,
      name: (i === myId) ? myName : (isMultiplayer ? "等待加入..." : PLAYER_NAMES[i]),
      isHuman: isMultiplayer ? (i === myId) : (i === 0), 
      isReady: !isMultiplayer || (host && i === 0) || (i !== 0 && i !== myId), 
      hand: [],
      discards: [],
      chips: 100 
    }));
    
    if (isMultiplayer && !host) {
        if(players[myId]) players[myId].isReady = false;
    }

    const randomStarter = Math.floor(Math.random() * count);

    setGame({
      mode,
      phase: GamePhase.LOBBY,
      playerCount: count,
      turnIndex: 0,
      dealerIndex: 0,
      wall: [],
      wallBreakIndex: 0,
      players,
      lastDiscard: null,
      winnerId: null,
      loserId: null,
      winningHand: null,
      logs: [`模式: ${isMultiplayer ? '多人連線' : '單機'} (${count}人)`, `我是 ${myName}`],
    });

    setNextRoundDealer(randomStarter);
    setMyPlayerId(myId);
    setIsHost(host);
    setShowLobby(false);
    setWinningTile(null);
    setWaitingReason('NONE');
    setIsProcessing(false);
    setSelectedTile(null);
    setDecisionTimer(0);
  };

  const toggleMute = () => {
      const muted = audioService.toggleMute();
      setIsMuted(muted);
  };

  // --- Multiplayer Setup (PeerJS) ---

  const createRoom = async () => {
      if (!createRoomIdInput) {
          alert("請輸入房間代碼");
          return;
      }
      if (!/^[A-Z0-9]{5}$/.test(createRoomIdInput)) {
          alert("房間代碼必須是5位英數字 (A-Z, 0-9)");
          return;
      }
      if (!playerNameInput.trim()) {
          alert("請輸入您的暱稱");
          return;
      }

      setIsConnecting(true);
      try {
          const id = await multiplayerService.init(createRoomIdInput, false);
          setRoomId(id);
          initGame(GameMode.MULTIPLAYER, 0, selectedPlayerCount, playerNameInput);
          
          // Setup Host Handshake
          multiplayerService.setHostMessageHandler((msg, peerId) => {
              if (msg.type === 'REQUEST_JOIN') {
                  handleJoinRequest(msg.payload.name, peerId);
              }
          });

      } catch (e) {
          console.error(e);
          if (e === 'ID_TAKEN') {
              alert("此代碼已被使用，請更換一個");
          } else {
              alert("建立房間失敗 (連線錯誤)");
          }
      } finally {
          setIsConnecting(false);
      }
  };

  const joinRoom = async () => {
      if (!joinInput) return;
      if (!playerNameInput.trim()) {
          alert("請輸入您的暱稱");
          return;
      }

      setIsConnecting(true);
      try {
          await multiplayerService.init(undefined, false);
          await multiplayerService.connectToHost(joinInput);
          setIsHost(false);
          
          // Send Request to Host with Name
          multiplayerService.send('REQUEST_JOIN', { name: playerNameInput });
          
          audioService.playBGM();
          setGame(prev => ({ ...prev, logs: ["正在連線到房間..."] }));
          setShowLobby(false);
          
      } catch (e) {
          console.error(e);
          alert("加入失敗: 代碼錯誤或無法連線");
          setShowLobby(true);
      } finally {
          setIsConnecting(false);
      }
  };

  const handleJoinRequest = (name: string, peerId: string) => {
      setGame(prev => {
          const newPlayers = [...prev.players];
          const emptyIndex = newPlayers.findIndex((p, i) => i !== 0 && !p.isHuman);
          
          if (emptyIndex !== -1) {
              newPlayers[emptyIndex] = {
                  ...newPlayers[emptyIndex],
                  name: name || `玩家 ${emptyIndex}`, // Use provided name
                  isHuman: true,
                  isReady: false
              };
              
              multiplayerService.sendToPeer(peerId, 'ASSIGN_ID', { id: emptyIndex });
              
              setTimeout(() => broadcastState(newPlayers), 100);
              
              return { ...prev, players: newPlayers, logs: [...prev.logs, `${name} 加入連線`] };
          }
          return prev;
      });
  };

  // --- Network Listeners ---
  
  useEffect(() => {
    multiplayerService.setOnMessage((msg: NetworkMessage) => {
        if (isHost) {
            switch(msg.type) {
                case 'ACTION_TOGGLE_READY':
                case 'ACTION_DRAW':
                case 'ACTION_DISCARD':
                case 'ACTION_EAT':
                case 'ACTION_WIN':
                case 'ACTION_PASS':
                case 'ACTION_CUT':
                     if (msg.senderId !== undefined) {
                         dispatchAction(msg.type, msg.payload, msg.senderId);
                     }
                     break;
            }
        } else {
            if (msg.type === 'ASSIGN_ID') {
                const myId = msg.payload.id;
                const myName = msg.payload.name;
                setMyPlayerId(myId);
                // initGame is not strictly needed here as SYNC_STATE follows immediately
            }
            else if (msg.type === 'SYNC_STATE') {
                const serverState = msg.payload;
                setGame(prev => ({
                    ...serverState,
                    mode: GameMode.MULTIPLAYER
                }));
                if (msg.payload.aux) {
                    setIsProcessing(msg.payload.aux.isProcessing);
                    setWaitingReason(msg.payload.aux.waitingReason);
                    setWinningTile(msg.payload.aux.winningTile);
                    setDecisionTimer(msg.payload.aux.decisionTimer);
                }
            }
        }
    });
  }, [isHost, game]); 

  // --- Broadcast (Host) ---
  const broadcastState = (playersOverride?: Player[]) => {
      if (isHost && game.mode === GameMode.MULTIPLAYER) {
          multiplayerService.send('SYNC_STATE', {
              ...game,
              players: playersOverride || game.players,
              aux: {
                  isProcessing,
                  waitingReason,
                  winningTile,
                  decisionTimer
              }
          });
      }
  };

  useEffect(() => {
      broadcastState();
  }, [game, isProcessing, waitingReason, winningTile, decisionTimer, isHost]);


  // --- Game Loop (Host Only) ---
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [game.logs]);

  useEffect(() => {
    if (!isHost) return; 

    if (!game.players || game.players.length === 0) return;
    if (game.phase !== GamePhase.PLAYING) return;
    if (waitingReason === 'HU') return;

    const currentPlayer = game.players[game.turnIndex];
    if (!currentPlayer) return;

    if (waitingReason === 'TURN_DECISION') {
        if (!currentPlayer.isHuman && !isProcessing) {
            setIsProcessing(true);
            setTimeout(() => executeBotDecision(currentPlayer), 1000);
        }
        return;
    }

    if (waitingReason === 'NONE' && !currentPlayer.isHuman && !isProcessing) {
         if (currentPlayer.hand.length % 3 === 2) {
             setIsProcessing(true);
             setTimeout(() => executeBotDiscardPhase(currentPlayer), 500);
         }
    }

  }, [game.phase, game.turnIndex, game.players, isProcessing, waitingReason, isHost]);

  useEffect(() => {
    if (!isHost) return;

    if (waitingReason === 'TURN_DECISION' && decisionTimer > 0) {
      timerRef.current = window.setTimeout(() => {
        setDecisionTimer(prev => prev - 1);
      }, 1000);
    } else if (waitingReason === 'TURN_DECISION' && decisionTimer === 0) {
      handleDefaultAction();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [waitingReason, decisionTimer, isHost]);


  // --- Action Dispatcher ---
  const dispatchAction = (type: NetworkActionType, payload: any = {}, senderOverride?: number) => {
      const sender = senderOverride !== undefined ? senderOverride : myPlayerId;
      
      if (isHost) {
          audioService.playClick();
          switch(type) {
              case 'ACTION_DRAW': performDraw(sender); break;
              case 'ACTION_DISCARD': if(payload.tile) handleDiscardProcess(sender, payload.tile); break;
              case 'ACTION_EAT': handleEat(sender); break;
              case 'ACTION_WIN': handleHumanWin(sender); break;
              case 'ACTION_PASS': handlePass(); break;
              case 'ACTION_CUT': if(payload.index !== undefined) handleCutWall(payload.index); break;
              case 'ACTION_TOGGLE_READY': 
                 setGame(prev => {
                     const newPlayers = prev.players.map((p, i) => 
                        i === sender ? { ...p, isReady: !p.isReady } : p
                     );
                     return {...prev, players: newPlayers};
                 });
                 break;
              case 'RESTART': 
                 if(payload.reset) initGame(game.mode, myPlayerId, game.playerCount); 
                 else startGame(); 
                 break;
          }
      } else {
          multiplayerService.send(type, payload, myPlayerId);
      }
  };


  // --- Logic Methods (Host State Modifiers) ---
  const startGame = () => {
    const deck = shuffleDeck(generateDeck());
    const starter = nextRoundDealer;
    
    setIsProcessing(false);
    setWaitingReason('NONE');
    setWinningTile(null);
    setSelectedTile(null);
    
    setGame(prev => ({
      ...prev,
      phase: GamePhase.CUTTING,
      wall: deck,
      dealerIndex: starter,
      turnIndex: starter,
      players: prev.players.map(p => ({...p, hand: [], discards: []})),
      logs: [...prev.logs, `--- 新回合開始 ---`, `由 ${prev.players[starter]?.name || '玩家'} 起手 (切牌)`],
      lastDiscard: null,
      winnerId: null,
      loserId: null,
      winningHand: null
    }));
  };

  const handleCutWall = (stackIndex: number) => {
    if (game.phase !== GamePhase.CUTTING) return;
    const dealer = game.players[game.dealerIndex];
    if (!dealer) return;

    audioService.playCut();
    setGame(prev => ({ 
        ...prev, 
        wallBreakIndex: stackIndex, 
        phase: GamePhase.DEALING,
        logs: [...prev.logs, `${dealer.name} 從第 ${stackIndex + 1} 疊開始拿牌`]
    }));
    
    if (isHost) {
        setTimeout(() => dealTiles(stackIndex), 600);
    }
  };

  useEffect(() => {
    if (isHost && game.phase === GamePhase.CUTTING) {
      const dealer = game.players[game.dealerIndex];
      if (dealer && !dealer.isHuman) {
        setTimeout(() => {
          handleCutWall(Math.floor(Math.random() * 16));
        }, 1000);
      }
    }
  }, [game.phase, game.dealerIndex, isHost]);


  const dealTiles = (startIndex: number) => {
    setGame(current => {
      const newWall = [...current.wall];
      const count = current.players.length;
      if (!current.players || count === 0) return current;

      const newPlayers = current.players.map(p => ({ ...p, hand: [] }));
      
      for (let i = 0; i < count; i++) {
        const pIndex = (current.dealerIndex + i) % count;
        if (newWall.length >= 4) {
            const draw = newWall.splice(0, 4);
            if (newPlayers[pIndex]) newPlayers[pIndex].hand = sortHand(draw);
        }
      }
      if (newWall.length > 0) {
          const dealerExtra = newWall.shift();
          if (dealerExtra && newPlayers[current.dealerIndex]) {
            newPlayers[current.dealerIndex].hand = sortHand([...newPlayers[current.dealerIndex].hand, dealerExtra]);
          }
      }

      return {
        ...current,
        wall: newWall,
        players: newPlayers,
        phase: GamePhase.PLAYING,
        turnIndex: current.dealerIndex,
        logs: [...current.logs, "發牌完成，遊戲開始！"]
      };
    });
    setWaitingReason('NONE');
    setIsProcessing(false);
  };

  const calculateAndApplyScores = (winnerId: number, winningHand: TileData[], loserId: number | null) => {
     setGame(current => {
        if (!current.players[winnerId]) return current;
        const newPlayers = [...current.players];
        const winner = newPlayers[winnerId];
        let payoutLogs: string[] = [];
        const count = current.players.length;

        const isHeavenly = (current.wall.length === 15) && (winnerId === current.dealerIndex) && (loserId === null);
        const isFive = isFivePawns(winningHand);
        let payAmount = 0;
        if (isHeavenly) { payAmount = 50; payoutLogs.push(`🀄 起手倒 (天胡)！每家付 ${payAmount} 元`); } 
        else if (isFive) { payAmount = 50; payoutLogs.push(`♟️ 五兵/五卒合手！支付 ${payAmount} 元`); } 
        else { payAmount = loserId !== null ? 10 : 20; }

        let nextDealer = 0;
        if (loserId !== null) {
            const loser = newPlayers[loserId];
            if (loser) {
                loser.chips -= payAmount;
                winner.chips += payAmount;
                payoutLogs.push(`${loser.name} 放槍！支付 ${payAmount} 元給 ${winner.name}`);
                nextDealer = loserId;
                payoutLogs.push(`下局莊家: ${loser.name} (放槍者)`);
            }
        } else {
            newPlayers.forEach(p => {
                if (p.id !== winnerId) { p.chips -= payAmount; winner.chips += payAmount; }
            });
            if (!isHeavenly && !isFive) payoutLogs.push(`自摸！其他家各付 ${payAmount} 元`);
            nextDealer = (winnerId + 1) % count;
            if (newPlayers[nextDealer]) payoutLogs.push(`下局莊家: ${newPlayers[nextDealer].name} (自摸者下家)`);
        }
        
        // --- SAVE GAME HISTORY TO LOCALSTORAGE ---
        if (isHost) {
            setTimeout(() => {
                try {
                    const historyItem = {
                        timestamp: new Date().toLocaleString(),
                        roomId: roomId || 'Singleplayer',
                        winner: newPlayers[winnerId].name,
                        winningHand: winningHand.map(t => t.label).join(' '),
                        loser: loserId !== null ? newPlayers[loserId].name : '自摸',
                        scores: newPlayers.map(p => ({ name: p.name, chips: p.chips })),
                    };
                    const savedHistory = localStorage.getItem('xiangqi_game_history');
                    const historyList = savedHistory ? JSON.parse(savedHistory) : [];
                    historyList.unshift(historyItem); // Add to top
                    if (historyList.length > 50) historyList.pop(); // Limit size
                    localStorage.setItem('xiangqi_game_history', JSON.stringify(historyList));
                } catch (e) {
                    console.error("Error saving history:", e);
                }
            }, 0);
        }
        // -----------------------------------------

        setNextRoundDealer(nextDealer);
        return { ...current, players: newPlayers, logs: [...current.logs, ...payoutLogs] };
     });
     audioService.playWin();
  };

  const handleDefaultAction = () => {
      if (!isHost) return;
      performDraw(game.turnIndex);
  };

  const startTurnDecision = (nextPlayerIndex: number) => {
      setGame(prev => ({ ...prev, turnIndex: nextPlayerIndex }));
      setWaitingReason('TURN_DECISION');
      setDecisionTimer(10); 
      setIsProcessing(false); 
  };

  const performDraw = (playerIndex: number) => {
    setWaitingReason('NONE');
    setDecisionTimer(0);
    setIsProcessing(false);
    audioService.playDraw();

    setGame(prev => {
      const count = prev.players.length;
      if (prev.wall.length === 0) {
        const nextDealer = (prev.dealerIndex + 1) % count;
        setNextRoundDealer(nextDealer);
        const nextPlayerName = prev.players[nextDealer]?.name || "下一位";
        return { ...prev, phase: GamePhase.GAME_OVER, logs: [...prev.logs, "流局！沒牌了。", `下局莊家: ${nextPlayerName}`] };
      }
      const p = prev.players[playerIndex];
      if (!p) return prev;
      if (p.hand.length >= 5) return prev;

      const newWall = [...prev.wall];
      const tile = newWall.shift()!;
      const newPlayers = [...prev.players];
      newPlayers[playerIndex] = { ...p, hand: sortHand([...p.hand, tile]) }; 
      
      return { ...prev, wall: newWall, players: newPlayers, logs: [...prev.logs, `${newPlayers[playerIndex].name} 摸了一張牌`] };
    });
  };

  const handleEat = async (playerIndex: number) => {
      if (game.playerCount === 2) return;

      if (!game.lastDiscard) return;
      setWaitingReason('NONE');
      setDecisionTimer(0);
      setIsProcessing(true);
      audioService.playClick();

      setGame(prev => {
          const p = prev.players[playerIndex];
          if (!p) return prev;
          const tile = prev.lastDiscard!;
          const newHand = sortHand([...p.hand, tile]);
          
          const count = prev.players.length;
          const discarderIndex = (playerIndex + count - 1) % count;
          const discarder = prev.players[discarderIndex];
          
          if (!discarder) return prev; 
          
          const newDiscards = [...discarder.discards];
          newDiscards.pop(); 
          
          const newPlayers = [...prev.players];
          newPlayers[playerIndex] = { ...p, hand: newHand };
          newPlayers[discarderIndex] = { ...discarder, discards: newDiscards };
          
          return { ...prev, players: newPlayers, lastDiscard: null, logs: [...prev.logs, `${p.name} 吃牌`] };
      });
      setTimeout(() => setIsProcessing(false), 300);
  };

  const handleDiscardProcess = async (playerId: number, tile: TileData) => {
      audioService.playDiscard();
      try {
          setGame(prev => {
              const p = prev.players[playerId];
              if (!p) return prev;
              const newHand = p.hand.filter(t => t.id !== tile.id);
              const newDiscards = [...p.discards, tile];
              const newPlayers = [...prev.players];
              newPlayers[playerId] = { ...p, hand: newHand, discards: newDiscards };
              return { ...prev, players: newPlayers, lastDiscard: tile, logs: [...prev.logs, `${p.name} 打出 ${tile.label}`] };
          });

          let winnerFound = -1;
          const count = game.players.length;
          
          for (let i = 1; i < count; i++) {
              const checkIdx = (playerId + i) % count;
              const playerToCheck = game.players[checkIdx]; 
              if (playerToCheck && checkWinWithTile(playerToCheck.hand, tile)) {
                  winnerFound = checkIdx;
                  break; 
              }
          }

          if (winnerFound !== -1) {
              const winner = game.players[winnerFound];
              if (winner && winner.isHuman) {
                  setWinningTile(tile);
                  setWaitingReason('HU');
              } else if (winner) {
                  handleGameWin(winnerFound, [...winner.hand, tile], playerId);
              }
              return;
          }
          startTurnDecision((playerId + 1) % count);
      } finally {
          setSelectedTile(null);
      }
  };
  
  const handleGameWin = (winnerId: number, finalHand: TileData[], loserId: number | null) => {
      if (!game.players[winnerId]) return;
      setGame(prev => ({
          ...prev,
          winnerId,
          loserId,
          winningHand: finalHand,
          phase: GamePhase.GAME_OVER,
          logs: [...prev.logs, `${prev.players[winnerId].name} 胡牌！`]
      }));
      calculateAndApplyScores(winnerId, finalHand, loserId);
  };

  const executeBotDecision = (bot: Player) => {
      if (!bot || !bot.hand) return;
      
      const canEatRule = game.playerCount !== 2;
      const usefulToEat = canEatRule && game.lastDiscard && getChiCombinations(bot.hand, game.lastDiscard).length > 0;
      
      if (usefulToEat && Math.random() > 0.5) {
          handleEat(bot.id);
      } else {
          performDraw(bot.id);
      }
  };

  const executeBotDiscardPhase = (bot: Player) => {
      if (!bot || !bot.hand) return;
      if (checkWin(bot.hand)) {
          handleGameWin(bot.id, bot.hand, null);
          return;
      }
      const discardTile = getBestDiscard(bot.hand);
      handleDiscardProcess(bot.id, discardTile);
  };

  const handleHumanTileClick = (tile: TileData) => {
      if (game.turnIndex !== myPlayerId) return;
      if (game.phase !== GamePhase.PLAYING) return;
      if (waitingReason !== 'NONE') return;
      if (isProcessing) return;

      if (selectedTile?.id === tile.id) {
          setIsProcessing(true);
          dispatchAction('ACTION_DISCARD', { tile });
      } else {
          setSelectedTile(tile);
          audioService.playClick();
      }
  };
  
  const handleHumanWin = (winnerId: number) => {
      if (waitingReason === 'HU' && winningTile) {
          handleGameWin(winnerId, [...game.players[winnerId].hand, winningTile], game.turnIndex); 
      } else if (game.turnIndex === winnerId && checkWin(game.players[winnerId].hand)) {
          handleGameWin(winnerId, game.players[winnerId].hand, null);
      }
  };
  
  const handlePass = () => {
      if (waitingReason === 'HU') {
          setWaitingReason('NONE');
          setWinningTile(null);
          startTurnDecision((game.turnIndex + 1) % game.players.length);
      }
  };

  const copyRoomId = () => {
      navigator.clipboard.writeText(roomId).then(() => {
          setCopySuccess("已複製!");
          setTimeout(() => setCopySuccess(""), 2000);
      });
  };

  // --- View Rendering Helpers ---
  const getRelativePosition = (playerId: number, myId: number, totalPlayers: number) => {
      let rel = (playerId - myId + totalPlayers) % totalPlayers;
      if (totalPlayers === 2) return rel === 0 ? 0 : 2;
      if (totalPlayers === 3) return rel === 0 ? 0 : (rel === 1 ? 1 : 3);
      return rel;
  };

  const renderPlayerHand = (player: Player, viewPosIndex: number) => {
    if (!player) return null;
    const isSelf = player.id === myPlayerId;
    const showFace = isSelf || game.phase === GamePhase.GAME_OVER;
    const displayHand = isSelf ? sortHand(player.hand) : player.hand;
    const containerStyle = isSelf ? '' : 'scale-[0.6] origin-center';

    return (
      <div className={`flex ${isSelf ? 'gap-1' : '-space-x-3'} items-end justify-center ${containerStyle}`}>
        {displayHand.map((tile, idx) => (
          <Tile 
            key={tile.id || idx} 
            tile={tile} 
            size={isSelf ? 'lg' : 'sm'} 
            faceDown={!showFace} 
            onClick={isSelf ? () => handleHumanTileClick(tile) : undefined}
            selected={isSelf && selectedTile?.id === tile.id}
            className={`transition-transform ${isSelf ? 'hover:-translate-y-2 hover:brightness-110' : ''}`}
          />
        ))}
      </div>
    );
  };

  const renderDiscardPile = (player: Player) => {
      if (!player) return null;
      return (
        <div className="grid grid-cols-3 gap-0.5 p-1 rounded-lg bg-black/40 border border-white/10 w-auto justify-items-center shadow-lg backdrop-blur-sm">
            {player.discards.map((tile) => (
                <Tile key={tile.id} tile={tile} size="sm" />
            ))}
        </div>
      );
  };

  const getPlayerStyle = (stdPos: number) => {
    switch (stdPos) {
        case 0: return { bottom: '100px', left: '50%', transform: 'translate(-50%, 0)', zIndex: 30 };
        case 1: return { right: '-25px', top: '50%', transform: 'translate(0, -50%) rotate(-90deg)', zIndex: 30 };
        case 2: return { top: '10px', left: '50%', transform: 'translate(-50%, 0) rotate(180deg)', zIndex: 30 };
        case 3: return { left: '-25px', top: '50%', transform: 'translate(0, -50%) rotate(90deg)', zIndex: 30 };
        default: return {};
    }
  };
  
  const getDiscardStyle = (stdPos: number) => {
    const offset = 105; 
    switch (stdPos) {
        case 0: return { top: '50%', left: '50%', transform: `translate(-50%, -50%) translate(0, ${offset}px)`, zIndex: 20 };
        case 1: return { top: '50%', left: '50%', transform: `translate(-50%, -50%) translate(${offset}px, 0) rotate(-90deg)`, zIndex: 20 };
        case 2: return { top: '50%', left: '50%', transform: `translate(-50%, -50%) translate(0, -${offset}px) rotate(180deg)`, zIndex: 20 };
        case 3: return { top: '50%', left: '50%', transform: `translate(-50%, -50%) translate(-${offset}px, 0) rotate(90deg)`, zIndex: 20 };
        default: return {};
    }
  };

  const getAvatarStyle = (stdPos: number) => {
    switch (stdPos) {
        case 0: return { bottom: '20px', left: '20px' };
        case 1: return { bottom: '20px', right: '20px' };
        case 2: return { top: '20px', right: '20px' };
        case 3: return { top: '20px', left: '20px' };
        default: return {};
    }
  };

  const isMyTurn = game.turnIndex === myPlayerId;
  const canDraw = waitingReason === 'TURN_DECISION' && isMyTurn;
  const canDiscard = waitingReason === 'NONE' && isMyTurn && !isProcessing;
  const canEat = game.lastDiscard && game.playerCount !== 2; 
  const isSessionOver = game.players.some(p => p.chips <= 0);
  const canCut = game.phase === GamePhase.CUTTING && game.dealerIndex === myPlayerId;
  const allPlayersReady = game.players.every(p => p.isReady);


  // --- View: Lobby ---
  if (showLobby) {
      return (
        <div className="w-full min-h-screen bg-[#1a472a] relative overflow-y-auto text-white flex items-center justify-center p-4">
            <div className="absolute inset-0 felt-texture opacity-50 pointer-events-none fixed"></div>
            <div className="bg-black/80 p-6 md:p-8 rounded-2xl shadow-2xl text-center max-w-md w-full border border-amber-500/30 backdrop-blur-sm z-10 my-8">
                <h1 className="text-3xl md:text-4xl font-bold text-amber-400 mb-6 font-serif">臺灣象棋麻將</h1>
                
                {/* Player Count Selector */}
                <div className="mb-6 bg-gray-800/50 p-3 rounded-lg border border-white/10">
                    <label className="text-sm text-gray-400 block mb-2">選擇遊戲人數</label>
                    <div className="flex justify-center gap-2">
                        {[2, 3, 4].map(count => (
                            <button key={count}
                                onClick={() => setSelectedPlayerCount(count)}
                                className={`px-4 py-2 rounded font-bold border ${selectedPlayerCount === count ? 'bg-amber-600 border-amber-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'}`}
                            >
                                {count}人局
                            </button>
                        ))}
                    </div>
                    {selectedPlayerCount === 2 && <div className="text-xs text-red-400 mt-2">* 2人局規則: 不可吃牌</div>}
                </div>

                {/* Player Name Input */}
                <div className="mb-6">
                    <input 
                        type="text" 
                        placeholder="請輸入您的暱稱 (最多6字)"
                        value={playerNameInput}
                        onChange={(e) => setPlayerNameInput(e.target.value)}
                        maxLength={6}
                        className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-amber-500 focus:outline-none text-center shadow-inner text-lg"
                    />
                </div>

                <div className="space-y-4">
                    <button onClick={() => initGame(GameMode.SINGLEPLAYER, 0, selectedPlayerCount, playerNameInput || "玩家")}
                        className="w-full py-4 bg-amber-700 hover:bg-amber-600 rounded-lg text-xl font-bold shadow-lg border-2 border-amber-500 transition-transform hover:scale-105"
                    >
                        單人挑戰 (vs 電腦)
                    </button>

                    <div className="border-t border-white/10 pt-4">
                        <h3 className="text-gray-400 mb-4 text-sm font-bold">多人連線 (P2P)</h3>
                        
                        {/* Create Room */}
                        {!roomId ? (
                             <div className="space-y-4">
                                <div className="flex gap-2">
                                     <input 
                                        type="text" 
                                        placeholder="設定房號(5碼)"
                                        value={createRoomIdInput}
                                        onChange={(e) => setCreateRoomIdInput(e.target.value.toUpperCase())}
                                        maxLength={5}
                                        className="w-32 px-2 py-2 bg-gray-800 rounded-lg border border-blue-500 focus:outline-none text-center uppercase text-sm tracking-widest"
                                    />
                                    <button onClick={createRoom} disabled={isConnecting}
                                        className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 rounded-lg font-bold border border-blue-500 flex justify-center items-center text-sm"
                                    >
                                        {isConnecting ? "建立中..." : "建立房間"}
                                    </button>
                                </div>
                                
                                {/* Join Room - Stacked */}
                                <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-white/10">
                                    <input 
                                        type="text" 
                                        placeholder="輸入房號加入"
                                        value={joinInput}
                                        onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                                        className="w-full sm:flex-1 px-4 py-3 bg-gray-800 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-400 text-center uppercase shadow-inner"
                                    />
                                    <button onClick={joinRoom} disabled={isConnecting || !joinInput}
                                        className="w-full sm:w-auto px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-500 font-bold shadow-md active:scale-95 transition-transform"
                                    >
                                        加入
                                    </button>
                                </div>
                             </div>
                        ) : (
                             <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-500/50">
                                 <p className="text-sm text-gray-300 mb-2">房間已建立 ({selectedPlayerCount}人)，等待加入...</p>
                                 <div className="text-2xl font-mono font-bold text-blue-300 mb-3 tracking-wider select-text">{roomId}</div>
                                 <button onClick={copyRoomId} className="text-sm bg-blue-600 px-3 py-1 rounded hover:bg-blue-500 transition-colors">
                                     {copySuccess || "複製代碼分享"}
                                 </button>
                             </div>
                        )}
                        <p className="text-xs text-gray-500 mt-4">
                            * 支援跨裝置連線，請輸入 5 位英數字作為房號。
                        </p>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  if (game.phase === GamePhase.LOBBY) {
      // FIX: Check if player data is synced before rendering
      if (!game.players[myPlayerId]) {
          return (
            <div className="w-full h-screen bg-[#1a472a] flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-t-amber-400 border-white/20 rounded-full animate-spin mx-auto mb-4"></div>
                    <p>正在連線中...</p>
                </div>
            </div>
          );
      }

      return (
        <div className="w-full min-h-screen bg-[#1a472a] relative overflow-y-auto text-white flex items-center justify-center p-4">
            <div className="absolute inset-0 felt-texture opacity-50 pointer-events-none fixed"></div>
            <div className="bg-black/80 p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-2xl border border-amber-500/30 backdrop-blur-sm z-10 my-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-amber-400">準備室</h2>
                    <div className="text-sm text-gray-400">房間: <span className="text-white font-mono">{roomId || '單機'}</span></div>
                </div>
                
                <div className={`grid gap-4 mb-8 ${game.playerCount === 2 ? 'grid-cols-2' : game.playerCount === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                    {game.players.map((p, i) => (
                        <div key={i} className={`
                            flex flex-col items-center p-4 rounded-lg border-2 
                            ${p.isReady ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800/20'}
                        `}>
                            <img src={AVATARS[i]} alt={p.name} className="w-16 h-16 rounded-full mb-2 object-cover"/>
                            <div className="font-bold text-lg mb-1">{p.name}</div>
                            <div className="text-xs text-gray-400 mb-2">
                                {i === myPlayerId ? '你 (P' + i + ')' : (p.isHuman ? '玩家' : '電腦')}
                            </div>
                            {p.isReady 
                                ? <span className="text-green-400 font-bold px-3 py-1 bg-green-900/50 rounded-full text-sm">已準備</span>
                                : <span className="text-gray-400 font-bold px-3 py-1 bg-gray-700/50 rounded-full text-sm">...</span>
                            }
                        </div>
                    ))}
                </div>

                <div className="flex justify-center gap-4">
                    {isHost ? (
                        <button 
                            onClick={startGame}
                            disabled={!allPlayersReady}
                            className={`px-8 py-3 rounded-lg font-bold text-xl shadow-lg transition-all
                                ${allPlayersReady 
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer hover:scale-105' 
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                            `}
                        >
                            {allPlayersReady ? '開始遊戲' : '等待玩家準備...'}
                        </button>
                    ) : (
                        <button 
                            onClick={() => dispatchAction('ACTION_TOGGLE_READY')}
                            className={`px-8 py-3 rounded-lg font-bold text-xl shadow-lg transition-all border-2
                                ${game.players[myPlayerId].isReady 
                                    ? 'bg-red-600 hover:bg-red-500 border-red-400' 
                                    : 'bg-green-600 hover:bg-green-500 border-green-400'}
                            `}
                        >
                            {game.players[myPlayerId].isReady ? '取消準備' : '準備完成'}
                        </button>
                    )}
                </div>
            </div>
        </div>
      );
  }

  // --- View: Main Game ---
  return (
    <div className="w-full h-screen bg-[#1a472a] relative overflow-hidden text-white select-none">
      <div className="absolute inset-0 felt-texture opacity-50 pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-black/20 pointer-events-none z-0" style={{background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 100%)'}}></div>
      
      <button onClick={toggleMute} className="absolute top-4 left-4 z-50 bg-black/40 p-2 rounded-full hover:bg-black/60 border border-white/20">
        {isMuted ? "🔇" : "🔊"}
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-xl pointer-events-none z-40 flex justify-center">
         <div className="bg-black/30 rounded-full px-4 py-1 backdrop-blur-sm text-amber-400/80 text-sm font-bold border border-white/5 shadow-sm">
            {roomId || '單機'} • P{myPlayerId} • {game.playerCount}人局
         </div>
      </div>
      
      <div className="absolute top-14 right-2 w-32 max-h-24 overflow-y-auto bg-black/30 rounded-lg p-1 text-[10px] pointer-events-auto backdrop-blur-sm z-40 border border-white/10 scrollbar-hide">
          {game.logs.map((log, i) => (
            <div key={i} className="mb-0.5 opacity-90 truncate">{log}</div>
          ))}
          <div ref={logsEndRef} />
      </div>

      <div className="absolute inset-0 z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <Wall 
                tiles={game.wall} 
                startBreakIndex={game.wallBreakIndex} 
                onCut={(idx) => dispatchAction('ACTION_CUT', { index: idx })}
                canCut={canCut}
                cutIndex={game.phase === GamePhase.DEALING ? game.wallBreakIndex : null}
            />
        </div>

        {game.players.map(player => {
            const stdPos = getRelativePosition(player.id, myPlayerId, game.playerCount);
            return (
                <React.Fragment key={player.id}>
                    <div className="absolute origin-center" style={getDiscardStyle(stdPos)}>
                        {renderDiscardPile(player)}
                    </div>
                    <div className="absolute origin-center" style={getPlayerStyle(stdPos)}>
                         {renderPlayerHand(player, stdPos)}
                    </div>
                    <div className="absolute z-30 flex flex-col items-center gap-1" style={getAvatarStyle(stdPos)}>
                        <div className={`relative w-12 h-12 rounded-full border-2 overflow-hidden shadow-lg bg-gray-800
                            ${game.turnIndex === player.id ? 'border-yellow-400 ring-4 ring-yellow-400/30' : 'border-white/20'}
                        `}>
                            <img src={AVATARS[player.id]} alt={player.name} className="w-full h-full object-cover" />
                            {game.dealerIndex === player.id && (
                                <div className="absolute bottom-0 right-0 bg-red-600 text-[10px] px-1 rounded-tl-md font-bold">莊</div>
                            )}
                        </div>
                        <div className="bg-black/60 px-2 py-0.5 rounded text-xs backdrop-blur-sm text-center min-w-[60px]">
                            <div className="text-amber-200 font-bold truncate max-w-[80px]">
                                {player.id === myPlayerId ? '我' : player.name}
                            </div>
                            <div className="text-green-300">${player.chips}</div>
                        </div>
                        {game.turnIndex === player.id && decisionTimer > 0 && (
                        <div className="h-1 w-full bg-gray-700 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-yellow-400 transition-all duration-1000 ease-linear" style={{width: `${(decisionTimer/10)*100}%`}}></div>
                        </div>
                        )}
                    </div>
                </React.Fragment>
            );
        })}
      </div>

      {winningTile && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-bounce">
              <div className="bg-red-600/90 text-white px-4 py-2 rounded-full shadow-xl text-lg font-bold flex items-center gap-2 backdrop-blur-sm border border-red-400">
                  <span>有人胡這張!</span>
                  <Tile tile={winningTile} size="sm" />
              </div>
          </div>
      )}

      <div className="absolute bottom-0 left-0 w-full p-6 flex justify-center gap-4 z-50 pointer-events-none">
        <div className="pointer-events-auto flex gap-4 items-end pb-4">
            {canDraw && (
                <>
                    <button onClick={() => dispatchAction('ACTION_DRAW')}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full shadow-lg font-bold text-lg border-2 border-blue-400 hover:scale-105 active:scale-95 transition-transform"
                    >
                        摸牌 ({decisionTimer}s)
                    </button>
                    {canEat && game.lastDiscard && (
                        <button onClick={() => dispatchAction('ACTION_EAT')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-full shadow-lg font-bold text-lg border-2 border-emerald-400 hover:scale-105 active:scale-95 transition-transform"
                        >
                            吃牌
                        </button>
                    )}
                </>
            )}

            {canDiscard && (
                 <div className="flex items-center gap-4 bg-black/40 p-2 rounded-full backdrop-blur-sm border border-white/10">
                    <div className="text-white/80 px-4">
                        {selectedTile ? `已選: ${selectedTile.label}` : "請選一張牌打出"}
                    </div>
                    <button 
                        disabled={!selectedTile}
                        onClick={() => selectedTile && dispatchAction('ACTION_DISCARD', { tile: selectedTile })}
                        className={`
                            px-8 py-3 rounded-full shadow-lg font-bold text-lg transition-all border-2
                            ${selectedTile 
                                ? 'bg-amber-600 hover:bg-amber-500 border-amber-400 scale-100 cursor-pointer' 
                                : 'bg-gray-600/50 border-gray-500/30 text-gray-400 scale-95 cursor-not-allowed'}
                        `}
                    >
                        打出
                    </button>
                 </div>
            )}
            
            {waitingReason === 'HU' && game.players[myPlayerId].isHuman && (
                winningTile && checkWinWithTile(game.players[myPlayerId].hand, winningTile) && 
                <div className="flex gap-4 animate-pulse">
                    <button onClick={() => dispatchAction('ACTION_WIN')}
                        className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-full shadow-xl font-bold text-2xl border-2 border-red-300"
                    >
                        胡牌!
                    </button>
                    <button onClick={() => dispatchAction('ACTION_PASS')}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-full shadow-lg font-bold text-lg border-2 border-gray-400"
                    >
                        過
                    </button>
                </div>
            )}

            {canDiscard && checkWin(game.players[myPlayerId].hand) && (
                 <button onClick={() => dispatchAction('ACTION_WIN')}
                    className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-full shadow-xl font-bold text-2xl border-2 border-red-300 ml-4"
                >
                    自摸!
                </button>
            )}
        </div>
      </div>
      
      {isProcessing && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50">
             <div className="bg-black/60 text-white px-4 py-1 rounded-full text-sm flex items-center gap-2 backdrop-blur-md">
                 <div className="w-3 h-3 rounded-full border-2 border-t-transparent border-white animate-spin"></div>
                 {isHost ? '處理中...' : '等待房主...'}
             </div>
          </div>
      )}

      {game.phase === GamePhase.GAME_OVER && (
        <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50 backdrop-blur-md p-4">
          <div className="bg-[#1a472a] p-6 md:p-8 rounded-2xl shadow-2xl border-2 border-amber-500/50 text-center max-w-lg w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600"></div>
            <h2 className="text-2xl md:text-3xl font-bold text-amber-400 mb-2">
                {game.winnerId !== null && game.players[game.winnerId] ? (
                    game.loserId !== null && game.players[game.loserId]
                    ? <span>{game.players[game.winnerId].name} 胡牌 (放槍: {game.players[game.loserId].name})</span>
                    : <span>{game.players[game.winnerId].name} 自摸!</span>
                ) : '本局流局'}
            </h2>
            <div className="text-gray-400 text-sm mb-6">
                {isSessionOver ? "遊戲結束" : "結算完成"}
            </div>

            {game.winningHand && (
                <div className="mb-6 p-4 bg-black/20 rounded-xl inline-block">
                    <div className="flex gap-2 justify-center flex-wrap">
                        {game.winningHand.map((t, i) => <Tile key={i} tile={t} size="md" />)}
                    </div>
                </div>
            )}

            <div className="space-y-2 mb-8 text-left bg-black/20 p-4 rounded-lg">
                 {game.players.map(p => (
                     <div key={p.id} className="flex justify-between items-center border-b border-white/5 pb-1 last:border-0">
                         <span className={p.id === game.winnerId ? 'text-yellow-400 font-bold' : 'text-gray-300'}>
                             {p.name} {p.id === game.dealerIndex ? '(莊)' : ''}
                         </span>
                         <span className={`font-mono ${p.chips <= 0 ? 'text-red-500 font-bold' : 'text-green-300'}`}>
                             ${p.chips}
                         </span>
                     </div>
                 ))}
            </div>

            {isHost ? (
                <button 
                    onClick={isSessionOver ? () => dispatchAction('RESTART', { reset: true }) : () => dispatchAction('RESTART', { reset: false })}
                    className={`text-white text-xl font-bold py-3 px-10 rounded-full shadow-lg border-2 ${isSessionOver ? 'bg-red-600 border-red-400' : 'bg-amber-600 border-amber-400'}`}
                >
                    {isSessionOver ? '重新開始' : '下一局'}
                </button>
            ) : (
                <div className="text-amber-500 animate-pulse">等待房主開始下一局...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;