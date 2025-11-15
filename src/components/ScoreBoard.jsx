import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import "../components/ScoreBoard.css";

/* ---------- Defaults & Migration ---------- */
const defaultExtras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
const defaultSettings = { overLimit: 5, maxWickets: 10 };

const baseTeamState = (name = "Team") => ({
  name,
  runs: 0,
  wickets: 0,
  ballsDelivered: 0,
  currentOverBalls: [],
  overHistory: [],
  extras: { ...defaultExtras }
});

const defaultState = {
  teamA: { ...baseTeamState("Team A") },
  teamB: { ...baseTeamState("Team B") },
  currentInnings: "A",
  matchSettings: { ...defaultSettings },
  _version: 2
};

const migrateOldData = (raw) => {
  if (!raw) return defaultState;
  try {
    const saved = typeof raw === "string" ? JSON.parse(raw) : raw;
    const out = { ...defaultState, ...saved };

    ["teamA", "teamB"].forEach((k) => {
      out[k] = {
        ...baseTeamState(out[k]?.name || (k === "teamA" ? "Team A" : "Team B")),
        ...(saved[k] || {}),
        extras: { ...defaultExtras, ...(saved[k]?.extras || {}) },
        ballsDelivered: Number(saved[k]?.ballsDelivered ?? saved[k]?.balls ?? 0)
      };

      if (!saved[k]?.ballsDelivered && saved[k]?.overs != null) {
        const oversFloat = Number(saved[k].overs) || 0;
        const whole = Math.floor(oversFloat);
        const balls = Math.round((oversFloat - whole) * 10);
        out[k].ballsDelivered = whole * 6 + balls;
      }

      out[k].currentOverBalls = Array.isArray(out[k].currentOverBalls) ? out[k].currentOverBalls : [];
      out[k].overHistory = Array.isArray(out[k].overHistory) ? out[k].overHistory : [];
    });

    out.matchSettings = { ...defaultSettings, ...(saved.matchSettings || {}) };
    out._version = 2;

    return out;
  } catch (e) {
    console.error("Migration failed:", e);
    return defaultState;
  }
};

/* ---------- Helpers ---------- */
const prettyOvers = (balls) => {
  const whole = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${whole}.${rem}`;
};

const persistToLocal = (data) => {
  try {
    localStorage.setItem("cricketScore", JSON.stringify(data));
  } catch (e) {
    console.error("Failed to persist:", e);
  }
};

/* ---------- Component ---------- */
const ScoreBoard = () => {
  // initialize match data from localStorage
  const initialMatchData = (() => {
    try {
      const raw = localStorage.getItem("cricketScore");
      return migrateOldData(raw || null);
    } catch (e) {
      console.error("Load error:", e);
      return defaultState;
    }
  })();

  const [matchData, setMatchData] = useState(initialMatchData);
  const [matchEnded, setMatchEnded] = useState(false);
  const [winnerText, setWinnerText] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const [batsmen, setBatsmen] = useState([
    { id: 1, name: "Batsman 1", runs: 0, balls: 0, isOut: false, howOut: null },
    { id: 2, name: "Batsman 2", runs: 0, balls: 0, isOut: false, howOut: null },
  ]);

  const [bowlers, setBowlers] = useState([
    { id: 1, name: "Bowler 1", overs: 0, maidens: 0, runs: 0, wickets: 0 }
  ]);
  const [currentBowler, setCurrentBowler] = useState(bowlers[0]?.id ?? 1);
  const [striker, setStriker] = useState(1);
  const [nonStriker, setNonStriker] = useState(2);

  // refs to keep latest values accessible inside event handlers without stale closure issues
  const strikerRef = useRef(striker);
  const nonStrikerRef = useRef(nonStriker);
  const bowlersRef = useRef(bowlers);

  useEffect(() => { strikerRef.current = striker; }, [striker]);
  useEffect(() => { nonStrikerRef.current = nonStriker; }, [nonStriker]);
  useEffect(() => { bowlersRef.current = bowlers; }, [bowlers]);

  useEffect(() => {
    if (matchEnded) {
      confetti({
        particleCount: 180,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [matchEnded]);

  // persist whenever matchData changes
  useEffect(() => {
    persistToLocal(matchData);
  }, [matchData]);

  const currentTeamKey = matchData.currentInnings === "A" ? "teamA" : "teamB";
  const otherTeamKey = matchData.currentInnings === "A" ? "teamB" : "teamA";
  const team = matchData[currentTeamKey];

  const isOverLimitReached = team.ballsDelivered >= matchData.matchSettings.overLimit * 6;
  const isAllOut = team.wickets >= matchData.matchSettings.maxWickets;

  /* -------------------- UNDO / REDO STATE -------------------- */
  // We'll keep undo/redo stacks in refs (to avoid heavy re-renders), and maintain counts in state so UI updates.
  const undoStackRef = useRef([]); // array of previous matchData snapshots
  const redoStackRef = useRef([]); // array of undone matchData snapshots
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  // helper to push current state onto undo stack and clear redo stack
  const pushToHistory = (prevState) => {
    try {
      const snapshot = JSON.parse(JSON.stringify(prevState));
      undoStackRef.current.push(snapshot);
      // clear redo stack whenever we make a new change
      redoStackRef.current = [];
      setUndoCount(undoStackRef.current.length);
      setRedoCount(0);
    } catch (e) {
      console.error("Failed to push to undo history:", e);
    }
  };

  const saveMatchData = (updater) => {
    setMatchData(prev => {
      const resolvedNext = typeof updater === "function" ? updater(prev) : updater;

      // push prev snapshot to undo before applying
      pushToHistory(prev);

      // apply the change and persist
      try {
        persistToLocal(resolvedNext);
      } catch (e) {
        console.error("Persist failed in saveMatchData:", e);
      }

      return resolvedNext;
    });
  };

  const undo = () => {
    if (undoStackRef.current.length === 0) return;

    // push current into redo
    try {
      const currentSnap = JSON.parse(JSON.stringify(matchData));
      redoStackRef.current.push(currentSnap);
    } catch (e) {
      console.error("Failed to push to redo:", e);
    }

    const prev = undoStackRef.current.pop();
    setMatchData(prev);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
  };

  const redo = () => {
    if (redoStackRef.current.length === 0) return;

    // push current into undo
    try {
      const currentSnap = JSON.parse(JSON.stringify(matchData));
      undoStackRef.current.push(currentSnap);
    } catch (e) {
      console.error("Failed to push to undo during redo:", e);
    }

    const next = redoStackRef.current.pop();
    setMatchData(next);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
  };

  // helper to swap strike reliably using refs
  const swapStrike = () => {
    const s = strikerRef.current;
    const ns = nonStrikerRef.current;
    // swap
    setStriker(ns);
    setNonStriker(s);
  };

  const updateBatsmanStats = (batsmanId, runs, isLegalDelivery = true) => {
    setBatsmen(prev => prev.map(b => {
      if (b.id !== batsmanId) return b;
      return {
        ...b,
        runs: b.runs + runs,
        balls: isLegalDelivery ? b.balls + 1 : b.balls
      };
    }));

    // rotate strike on odd runs
    if (runs % 2 !== 0) {
      swapStrike();
    }
  };

  const updateBowlerStatsImmediate = (bowlerId, runs = 0, isWicket = false) => {
    setBowlers(prev => prev.map(b => {
      if (b.id !== bowlerId) return b;
      return {
        ...b,
        runs: b.runs + runs,
        wickets: isWicket ? (b.wickets + 1) : b.wickets
      };
    }));
  };

  const completeLegalDelivery = ({ runs = 0, ballToken = null, isWicket = false, extraType = null }) => {
    saveMatchData(prev => {
      const next = { ...prev };
      const tKey = next.currentInnings === "A" ? "teamA" : "teamB";
      const t = { ...next[tKey] };

      t.runs = (t.runs || 0) + runs;
      t.ballsDelivered = (t.ballsDelivered || 0) + 1;

      if (ballToken !== null) {
        t.currentOverBalls = [...(t.currentOverBalls || []), ballToken];
      } else {
        t.currentOverBalls = [...(t.currentOverBalls || []), (runs === 0 && !isWicket ? "0" : String(runs))];
      }

      // If over completes now (6 legal balls)
      if (t.ballsDelivered % 6 === 0) {
        t.overHistory = [...(t.overHistory || []), t.currentOverBalls];
        t.currentOverBalls = [];

        // compute runs conceded in the last over
        const lastOver = t.overHistory[t.overHistory.length - 1] || [];
        const lastOverRuns = lastOver.reduce((sum, token) => {
          if (token === "Wd" || token === "Nb") return sum;
          if (typeof token === "string" && /^B\d+|Lb\d+/.test(token)) {
            const m = token.match(/\d+/);
            return sum + (m ? Number(m[0]) : 0);
          }
          const n = parseInt(token, 10);
          return isNaN(n) ? sum : sum + n;
        }, 0);

        // update bowler overs & maidens using safe ref to bowlers
        const bowlerId = currentBowler;
        setBowlers(prevBowls => prevBowls.map(b => {
          if (b.id !== bowlerId) return b;
          const overs = (b.overs || 0) + 1;
          const maidens = (b.maidens || 0) + (lastOverRuns === 0 ? 1 : 0);
          return { ...b, overs, maidens };
        }));

        // rotate ends (swap striker/non-striker)
        swapStrike();

        // rotate bowler to next available using bowlersRef to avoid stale closure
        setCurrentBowler(prevBowlerId => {
          const bowList = bowlersRef.current && bowlersRef.current.length ? bowlersRef.current : [{ id: prevBowlerId }];
          const idx = bowList.findIndex(b => b.id === prevBowlerId);
          const nextIdx = (idx + 1) % bowList.length;
          return bowList[nextIdx].id;
        });
      }

      next[tKey] = t;
      return next;
    });

    // immediate bowler update for runs/wicket for the delivery
    updateBowlerStatsImmediate(currentBowler, runs, isWicket);
  };

  const addExtraNoBallWide = (type, runs = 1) => {
    saveMatchData(prev => {
      const next = { ...prev };
      const tKey = next.currentInnings === "A" ? "teamA" : "teamB";
      const t = { ...next[tKey] };

      t.extras = { ...(t.extras || defaultExtras) };
      t.extras[type] = (t.extras[type] || 0) + runs;
      t.runs = (t.runs || 0) + runs;

      t.currentOverBalls = [...(t.currentOverBalls || []), type === "wides" ? "Wd" : "Nb"];

      next[tKey] = t;
      return next;
    });

    updateBowlerStatsImmediate(currentBowler, runs, false);
  };

  const addRun = (run) => {
    if (matchEnded || isOverLimitReached || isAllOut) return;
    if (typeof run !== "number") return;

    // update batsman stats
    setBatsmen(prev => prev.map(b => (b.id === striker ? { ...b, runs: b.runs + run, balls: b.balls + 1 } : b)));

    if (run % 2 !== 0) {
      swapStrike();
    }

    completeLegalDelivery({ runs: run, ballToken: String(run), isWicket: false });
  };

  const addWicket = () => {
    if (matchEnded || isOverLimitReached || isAllOut) return;

    setBatsmen(prev => prev.map(b => b.id === striker ? { ...b, isOut: true, howOut: `b ${bowlerName(currentBowler)}` } : b));

    saveMatchData(prev => {
      const next = { ...prev };
      const tKey = next.currentInnings === "A" ? "teamA" : "teamB";
      const t = { ...next[tKey] };
      t.wickets = (t.wickets || 0) + 1;
      next[tKey] = t;
      return next;
    });

    completeLegalDelivery({ runs: 0, ballToken: "W", isWicket: true });

    setBatsmen(prev => {
      const next = [...prev];
      const nextBatsman = next.find(b => !b.isOut && b.id !== striker && b.id !== nonStriker);
      if (nextBatsman) {
        setStriker(nextBatsman.id);
      } else {
        const t = matchData[currentTeamKey];
        const wicketsNow = (t?.wickets || 0) + 1;
        if (wicketsNow >= matchData.matchSettings.maxWickets) {
          endMatch();
        }
      }
      return next;
    });

    updateBowlerStatsImmediate(currentBowler, 0, true);
  };

  const addExtra = (type, runs = 1) => {
    if (matchEnded || isOverLimitReached || isAllOut) return;
    if (!["wides", "noBalls", "byes", "legByes"].includes(type)) return;

    if (type === "wides" || type === "noBalls") {
      addExtraNoBallWide(type, runs);
    } else {
      const token = type === "byes" ? (runs > 1 ? `B${runs}` : "B") : (runs > 1 ? `Lb${runs}` : "Lb");
      updateBowlerStatsImmediate(currentBowler, runs, false);
      completeLegalDelivery({ runs, ballToken: token, isWicket: false });
      setBatsmen(prev => prev.map(b => (b.id === striker ? { ...b, balls: b.balls + 1 } : b)));
    }
  };

  const getRunsAndBallsToWin = () => {
    if (matchData.currentInnings !== "B") return null;
    const target = matchData.teamA.runs + 1;
    const runsNeeded = Math.max(0, target - matchData.teamB.runs);
    const ballsBowled = matchData.teamB.ballsDelivered || 0;
    const totalBalls = matchData.matchSettings.overLimit * 6;
    const ballsLeft = Math.max(0, totalBalls - ballsBowled);
    return { runsNeeded, ballsLeft };
  };

  const getRequiredRunRate = () => {
    if (matchData.currentInnings !== "B") return null;
    const info = getRunsAndBallsToWin();
    if (!info || info.ballsLeft <= 0) return null;
    const oversLeft = info.ballsLeft / 6;
    return oversLeft > 0 ? (info.runsNeeded / oversLeft).toFixed(2) : "—";
  };

  const getOversLeft = () => {
    const info = getRunsAndBallsToWin();
    if (!info) return null;
    const overs = Math.floor(info.ballsLeft / 6);
    const balls = info.ballsLeft % 6;
    return balls > 0 ? `${overs}.${balls}` : `${overs}`;
  };

  const calculateCurrentRunRate = (teamKey = currentTeamKey) => {
    const t = matchData[teamKey];
    if (!t) return "0.00";
    const balls = t.ballsDelivered || 0;
    if (balls === 0) return "0.00";
    const oversDecimal = balls / 6;
    const rr = (t.runs / oversDecimal) || 0;
    return rr.toFixed(2);
  };

  const getProjectedScore = () => {
    if (matchEnded || isAllOut) return null;
    const runRate = parseFloat(calculateCurrentRunRate(currentTeamKey)) || 0;
    const totalBalls = matchData.matchSettings.overLimit * 6;
    const ballsLeft = Math.max(0, totalBalls - team.ballsDelivered);
    const oversLeftDecimal = ballsLeft / 6;
    return Math.round(team.runs + (runRate * oversLeftDecimal));
  };

  const endMatch = () => {
    const runsA = matchData.teamA.runs;
    const runsB = matchData.teamB.runs;
    const wicketsB = matchData.teamB.wickets;

    let winner = "";
    let winDetail = "";

    if (runsA > runsB) {
      winner = matchData.teamA.name;
      winDetail = `won by ${runsA - runsB} run${runsA - runsB !== 1 ? "s" : ""}`;
    } else if (runsB > runsA) {
      winner = matchData.teamB.name;
      const wicketsLeft = matchData.matchSettings.maxWickets - wicketsB;
      winDetail = `won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? "s" : ""}`;
    } else {
      winner = "It's a Tie!";
    }

    setWinnerText(`${winner} ${winDetail}`.trim());
    setMatchEnded(true);
  };

  const resetPlayers = () => {
    setBatsmen([
      { id: 1, name: "Batsman 1", runs: 0, balls: 0, isOut: false, howOut: null },
      { id: 2, name: "Batsman 2", runs: 0, balls: 0, isOut: false, howOut: null }
    ]);
    setBowlers([
      { id: 1, name: "Bowler 1", overs: 0, maidens: 0, runs: 0, wickets: 0 }
    ]);
    setCurrentBowler(1);
    setStriker(1);
    setNonStriker(2);
  };

  const resetMatch = () => {
    // push current into history and set default
    saveMatchData(defaultState);
    resetPlayers();
    setMatchEnded(false);
    setWinnerText("");
    localStorage.removeItem("cricketScore");
  };

  const switchInnings = () => {
    if (matchEnded) return;
    if (matchData.currentInnings === "A" && matchData.teamA.ballsDelivered === 0 && matchData.teamA.runs === 0) {
      alert("Team A hasn't scored any runs yet. Please add some runs before switching innings.");
      return;
    }

    saveMatchData(prev => ({ ...prev, currentInnings: prev.currentInnings === "A" ? "B" : "A" }));
    resetPlayers();
  };

  const simulateToss = () => {
    const tossWinner = Math.random() > 0.5 ? "teamA" : "teamB";
    const decision = Math.random() > 0.5 ? "bat" : "bowl";

    saveMatchData(prev => {
      const next = { ...prev };
      next.currentInnings = decision === "bat"
        ? (tossWinner === "teamA" ? "A" : "B")
        : (tossWinner === "teamA" ? "B" : "A");
      return next;
    });

    resetPlayers();
  };

  const bowlerName = (bowlerId) => {
    const b = bowlers.find(x => x.id === bowlerId);
    return b ? b.name : `Bowler ${bowlerId}`;
  };

  const getRecentBalls = (t) => {
    const all = [...(t.overHistory || []).flat(), ...(t.currentOverBalls || [])];
    return all.slice(-10);
  };

  /* ---------- JSX UI (modified to include Undo/Redo) ---------- */
  return (
    <motion.div
      className="bodyDiv"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
    >
      <motion.h1 className="heading" whileHover={{ scale: 1.02 }}>
        Cricket Score Tracker
      </motion.h1>

      <motion.div
        className="settings-btn"
        onClick={() => setShowSettings(s => !s)}
        whileTap={{ scale: 0.95 }}
      >
        {showSettings ? "Hide Settings" : "Settings"}
      </motion.div>

      {showSettings && (
        <motion.div className="settings-panel" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h3>Match Settings</h3>
          <div className="setting-item">
            <label>Overs per innings:</label>
            <input
              type="number"
              min="1"
              max="50"
              value={matchData.matchSettings.overLimit}
              onChange={e => {
                const val = Math.max(1, Math.min(50, Number(e.target.value)));
                saveMatchData(prev => ({ ...prev, matchSettings: { ...prev.matchSettings, overLimit: val } }));
              }}
              disabled={team.ballsDelivered > 0}
            />
          </div>
          <div className="setting-item">
            <label>Wickets per innings:</label>
            <input
              type="number"
              min="1"
              max="20"
              value={matchData.matchSettings.maxWickets}
              onChange={e => {
                const val = Math.max(1, Math.min(20, Number(e.target.value)));
                saveMatchData(prev => ({ ...prev, matchSettings: { ...prev.matchSettings, maxWickets: val } }));
              }}
            />
          </div>
          <motion.button
            onClick={() => {
              localStorage.removeItem("cricketScore");
              resetMatch();
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Reset All Data
          </motion.button>
        </motion.div>
      )}

      <div className="teamBox">
        { ["teamA", "teamB"].map(teamKey => (
          <motion.input
            key={teamKey}
            type="text"
            value={matchData[teamKey].name}
            onChange={e => {
              const name = e.target.value.substring(0, 20);
              saveMatchData(prev => ({ ...prev, [teamKey]: { ...prev[teamKey], name } }));
            }}
            className={`teamDiv ${teamKey === currentTeamKey ? 'active-team' : ''}`}
            whileHover={{ scale: 1.01 }}
            whileFocus={{ scale: 1.02 }}
            maxLength="20"
          />
        ))}
      </div>

      <motion.h2 className="InningHeading" whileHover={{ scale: 1.01 }}>
        {team.name} — <span className="text-green-700">Innings {matchData.currentInnings}</span>
      </motion.h2>

      <motion.div className="teamScore" whileHover={{ scale: 1.01 }}>
        <div>Score: <strong>{team.runs}/{team.wickets}</strong></div>
        <div>Overs: <strong>{prettyOvers(team.ballsDelivered)}</strong></div>
        <div>Run Rate: <strong>{calculateCurrentRunRate()}</strong></div>
        {!matchEnded && !isAllOut && <div>Projected: <strong>{getProjectedScore()}</strong></div>}
      </motion.div>

      {matchData.currentInnings === "B" && (
        <motion.div className="targetScore" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
          <h3>Target: <strong>{matchData.teamA.runs + 1}</strong></h3>
          <div className="runs-needed">
            {(() => {
              const info = getRunsAndBallsToWin();
              const reqRR = getRequiredRunRate();
              const oversLeft = getOversLeft();
              return info && info.runsNeeded > 0 && info.ballsLeft > 0 ? (
                <>
                  Needs <motion.span animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>{info.runsNeeded}</motion.span> runs from <span>{info.ballsLeft}</span> balls
                  (<span>{oversLeft}</span> overs)<br />
                  Required RR: <span>{reqRR}</span>
                </>
              ) : info?.runsNeeded <= 0 ? ("Target achieved!") : null;
            })()}
          </div>
        </motion.div>
      )}

      <motion.div className="currentOver" whileHover={{ scale: 1.01 }}>
        <h3>Current Over:</h3>
        <div className="balls-container">
          {team.currentOverBalls.map((ball, idx, arr) => {
            const isBouncy = ball === '6' && arr[idx - 1] === '6';
            const classes = `ball ${ball === 'Wd' ? 'wide' : ball === 'Nb' ? 'no-ball' : ball === 'W' ? 'wicket' : (ball === '4' || ball === '6') ? 'boundary' : ''} ${isBouncy ? 'bouncy' : ''}`;
            return (
              <motion.div key={idx} className={classes} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                {ball}
              </motion.div>
            );
          })}
          {[...Array(Math.max(0, 6 - (team.ballsDelivered % 6)))] .map((_, i) => (
            <div key={i + 100} className="ball empty" />
          ))}
        </div>
      </motion.div>

      <div className="btnDiv">
        {[1, 2, 3, 4, 6].map(num => (
          <motion.button key={num} onClick={() => addRun(num)} className="runBtn" disabled={isOverLimitReached || matchEnded || isAllOut} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            +{num}
          </motion.button>
        ))}
        <motion.button onClick={() => addRun(0)} className="runBtn" disabled={isOverLimitReached || matchEnded || isAllOut} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          0
        </motion.button>
      </div>

      <div className="special-btns">
        <motion.button onClick={() => addExtra('wides')} className="WideBtn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={isOverLimitReached || matchEnded || isAllOut}>
          Wide +1
        </motion.button>
        <motion.button onClick={() => addExtra('noBalls')} className="NoBallBtn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={isOverLimitReached || matchEnded || isAllOut}>
          No Ball +1
        </motion.button>
        <motion.button onClick={() => addExtra('byes')} className="ByeBtn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={isOverLimitReached || matchEnded || isAllOut}>
          Bye +1
        </motion.button>
        <motion.button onClick={() => addExtra('legByes')} className="LegByeBtn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={isOverLimitReached || matchEnded || isAllOut}>
          Leg Bye +1
        </motion.button>
        <motion.button onClick={addWicket} className="wicketBtn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={isOverLimitReached || matchEnded || isAllOut} animate={{ scale: [1, 1.05, 1], backgroundColor: ['#c0392b', '#e74c3c', '#c0392b'] }} transition={{ duration: 1.5, repeat: Infinity }}>
          Wicket
        </motion.button>
      </div>

      <div className="match-controls">
        {!matchEnded && (
          <motion.button className="endMatchBtn" onClick={endMatch} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            End Match
          </motion.button>
        )}

        <motion.button onClick={switchInnings} className="switchBtn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={matchEnded}>
          Switch Innings
        </motion.button>

        <motion.button onClick={resetMatch} className="resetBtn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          Reset Match
        </motion.button>

        {/* Undo / Redo Buttons */}
        <motion.button onClick={undo} className="undoBtn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={undoCount === 0} style={{ marginLeft: 8 }}>
          Undo {undoCount > 0 ? `(${undoCount})` : ''}
        </motion.button>

        <motion.button onClick={redo} className="redoBtn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={redoCount === 0} style={{ marginLeft: 8 }}>
          Redo {redoCount > 0 ? `(${redoCount})` : ''}
        </motion.button>

      </div>

      <motion.div className="extras-summary" whileHover={{ scale: 1.01 }}>
        <motion.div className="recent-timeline" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ margin: "2rem 0" }}>
          <h3 style={{ textAlign: "center", marginBottom: "1rem" }}>Recent 10 Balls</h3>
          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {(() => {
              const recent = getRecentBalls(team);
              return recent.length > 0 ? recent.map((ball, idx) => (
                <span key={idx} className={`ball timeline-ball ${ball === 'W' ? 'wicket' : ball === '4' || ball === '6' ? 'boundary' : ''}`} style={{ margin: "0 2px", fontWeight: 700, fontSize: "1.1rem", border: "2px solid #eee", background: "#fff", minWidth: 28, minHeight: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", boxShadow: "0 2px 4px rgba(0,0,0,0.07)" }}>
                  {ball}
                </span>
              )) : <span style={{ color: "#888" }}>No balls yet</span>;
            })()}
          </div>
        </motion.div>

        <h4>Extras:</h4>
        <div className="extras-grid">
          <div>Wides: {team.extras?.wides || 0}</div>
          <div>No Balls: {team.extras?.noBalls || 0}</div>
          <div>Byes: {team.extras?.byes || 0}</div>
          <div>Leg Byes: {team.extras?.legByes || 0}</div>
        </div>
      </motion.div>

      {matchEnded && (
        <motion.div className="celebration" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <motion.h1 className="winnerHeading" animate={{ color: ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'] }} transition={{ duration: 3, repeat: Infinity }}>
            Match Over!
          </motion.h1>
          <motion.h2 className="winnerText" animate={{ scale: [1, 1.05, 1], color: ['#2e7d32', '#27ae60', '#2e7d32'] }} transition={{ duration: 2, repeat: Infinity }}>
            🎉 {winnerText === "It's a Tie!" ? "Match Tied!" : winnerText} 🎉
          </motion.h2>

          <div className="match-summary">
            <h3>Match Summary</h3>
            <div className="summary-grid">
              <motion.div whileHover={{ scale: 1.02 }}>
                <h4>{matchData.teamA.name}</h4>
                <p>{matchData.teamA.runs}/{matchData.teamA.wickets} in {prettyOvers(matchData.teamA.ballsDelivered)} overs</p>
                <p>RR: {calculateCurrentRunRate('teamA')}</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }}>
                <h4>{matchData.teamB.name}</h4>
                <p>{matchData.teamB.runs}/{matchData.teamB.wickets} in {prettyOvers(matchData.teamB.ballsDelivered)} overs</p>
                <p>RR: {calculateCurrentRunRate('teamB')}</p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div className="over-history" whileHover={{ scale: 1.01 }}>
        <h3>Over History</h3>
        {team.overHistory.length > 0 ? (
          <div className="overs-container">
            {team.overHistory.map((over, overIdx) => (
              <motion.div key={overIdx} className="over-item" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: overIdx * 0.05 }}>
                <div className="over-number">Over {overIdx + 1}</div>
                <div className="over-balls">
                  {over.map((ball, ballIdx) => (
                    <motion.span key={ballIdx} className={`ball ${ball === 'W' ? 'wicket' : ball === '4' || ball === '6' ? 'boundary' : ''}`} whileHover={{ scale: 1.1 }}>
                      {ball}
                    </motion.span>
                  ))}
                  {[...Array(Math.max(0, 6 - over.length))].map((_, i) => <span key={i + 200} className="ball empty" />)}
                </div>
                <div className="over-runs">
                  Runs: {over.reduce((sum, token) => {
                    if (token === 'Wd' || token === 'Nb') return sum;
                    if (typeof token === "string" && /^B\d+|Lb\d+/.test(token)) {
                      const m = token.match(/\d+/);
                      return sum + (m ? Number(m[0]) : 0);
                    }
                    const n = parseInt(token, 10);
                    return isNaN(n) ? sum : sum + n;
                  }, 0)}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p>No over history available.</p>
        )}
      </motion.div>

      <div className="footer">
        <p className="footerText">Cricket Score Tracker v7.0.0</p>
        <p className="footerText">Developed by Akshat Singhai</p>
        <p className="footerText">
          <a target="_blank" rel="noopener noreferrer" href="https://www.linkedin.com/in/akshat-singhai-727bb5302/">LinkedIn Profile</a>
        </p>
      </div>
    </motion.div>
  );
};

export default ScoreBoard;
