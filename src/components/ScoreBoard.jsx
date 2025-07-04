import React, { useState, useEffect } from "react";
import "../components/ScoreBoard.css";
import { motion } from "framer-motion";

// Default extras object
const defaultExtras = {
  wides: 0,
  noBalls: 0,
  byes: 0,
  legByes: 0
};

// Default settings with all required properties
const defaultSettings = {
  overLimit: 5,
  maxWickets: 10,
  isPowerplay: false,
  powerplayOvers: 6
};

// Complete default state
const defaultState = {
  teamA: { 
    name: "Team A", 
    runs: 0, 
    wickets: 0, 
    overs: 0, 
    ballsDelivered: 0,
    currentOverBalls: [], 
    overHistory: [],
    extras: { ...defaultExtras }
  },
  teamB: { 
    name: "Team B", 
    runs: 0, 
    wickets: 0, 
    overs: 0,
    ballsDelivered: 0,
    currentOverBalls: [], 
    overHistory: [],
    extras: { ...defaultExtras }
  },
  currentInnings: "A",
  matchSettings: defaultSettings,
  matchInfo: {
    venue: "Home Ground",
    date: new Date().toISOString().split('T')[0],
    tossWinner: null,
    tossDecision: null
  },
  _version: 2
};

// Migration function for old localStorage data
const migrateOldData = (savedData) => {
  const migratedTeams = {};
  
  ['teamA', 'teamB'].forEach(teamKey => {
    if (savedData[teamKey]) {
      migratedTeams[teamKey] = {
        ...defaultState[teamKey],
        ...savedData[teamKey],
        extras: {
          ...defaultExtras,
          ...(savedData[teamKey].extras || {})
        }
      };
    }
  });

  return {
    ...defaultState,
    ...savedData,
    ...migratedTeams,
    matchSettings: {
      ...defaultSettings,
      ...(savedData.matchSettings || {})
    }
  };
};

const ScoreBoard = () => {
  const [matchData, setMatchData] = useState(() => {
    try {
      const saved = localStorage.getItem("cricketScore");
      return saved ? migrateOldData(JSON.parse(saved)) : defaultState;
    } catch (e) {
      console.error("Error loading saved data:", e);
      return defaultState;
    }
  });

  const [timer, setTimer] = useState(0);
  const [matchEnded, setMatchEnded] = useState(false);
  const [winner, setWinner] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showMatchInfo, setShowMatchInfo] = useState(false);
  const [batsmen, setBatsmen] = useState([
    { id: 1, name: "Batsman 1", runs: 0, balls: 0, isOut: false, howOut: null },
    { id: 2, name: "Batsman 2", runs: 0, balls: 0, isOut: false, howOut: null }
  ]);
  const [bowlers, setBowlers] = useState([
    { id: 1, name: "Bowler 1", overs: 0, maidens: 0, runs: 0, wickets: 0 }
  ]);
  const [currentBowler, setCurrentBowler] = useState(1);
  const [striker, setStriker] = useState(1);
  const [nonStriker, setNonStriker] = useState(2);

  const currentTeam = matchData.currentInnings === "A" ? "teamA" : "teamB";
  const team = matchData[currentTeam];
  const isOverLimitReached = team.overs >= matchData.matchSettings.overLimit;
  const isAllOut = team.wickets >= matchData.matchSettings.maxWickets;

  useEffect(() => {
    const interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    ['teamA', 'teamB'].forEach(teamKey => {
      if (matchData[teamKey] && (!matchData[teamKey].extras || typeof matchData[teamKey].extras !== 'object')) {
        const newData = { ...matchData };
        newData[teamKey].extras = { ...defaultExtras };
        updateStorage(newData);
      }
    });
  }, [matchData]);

  const updateStorage = (data) => {
    const completeData = migrateOldData(data);
    setMatchData(completeData);
    localStorage.setItem("cricketScore", JSON.stringify(completeData));
  };

  const updateBatsmanStats = (batsmanId, runs) => {
    setBatsmen(prev => prev.map(batsman => 
      batsman.id === batsmanId 
        ? { ...batsman, runs: batsman.runs + runs, balls: batsman.balls + 1 } 
        : batsman
    ));
    
    if (runs % 2 !== 0 && runs !== 5) {
      setStriker(prev => prev === striker ? nonStriker : striker);
    }
  };

  const updateBowlerStats = (bowlerId, runs, isWicket) => {
    setBowlers(prev => prev.map(bowler => 
      bowler.id === bowlerId 
        ? { 
            ...bowler, 
            runs: bowler.runs + runs,
            wickets: isWicket ? bowler.wickets + 1 : bowler.wickets,
            overs: bowler.overs + (team.currentOverBalls.length === 5 ? 1 : 0),
            maidens: bowler.maidens + (runs === 0 && team.currentOverBalls.length === 5 ? 1 : 0)
          } 
        : bowler
    ));
  };

  const addRun = (run) => {
    if (isOverLimitReached || matchEnded || isAllOut || typeof run !== 'number') return;
    
    const newData = { ...matchData };
    const team = newData[currentTeam];
    
    team.runs += run;
    team.ballsDelivered += 1;
    team.overs = updateOvers(team.overs);
    ballTracker(team, run.toString());
    
    updateBatsmanStats(striker, run);
    updateBowlerStats(currentBowler, run, false);
    
    updateStorage(newData);
  };

  const addWicket = () => {
    if (isOverLimitReached || matchEnded || isAllOut) return;
    
    const newData = { ...matchData };
    const team = newData[currentTeam];
    
    team.wickets += 1;
    team.ballsDelivered += 1;
    team.overs = updateOvers(team.overs);
    ballTracker(team, "W");
    
    setBatsmen(prev => prev.map(batsman => 
      batsman.id === striker 
        ? { ...batsman, isOut: true, howOut: "b Bowler" } 
        : batsman
    ));
    
    updateBowlerStats(currentBowler, 0, true);
    
    const nextBatsman = batsmen.find(b => !b.isOut && b.id !== nonStriker);
    if (nextBatsman) {
      setStriker(nextBatsman.id);
    } else if (team.wickets >= matchData.matchSettings.maxWickets - 1) {
      endMatch();
    }
    
    updateStorage(newData);
  };

  const addExtra = (type, runs = 1) => {
    if (isOverLimitReached || matchEnded || isAllOut || !['wides', 'noBalls', 'byes', 'legByes'].includes(type)) return;
    
    const newData = { ...matchData };
    const team = newData[currentTeam];
    
    team.extras = team.extras || { ...defaultExtras };
    team.extras[type] = (team.extras[type] || 0) + runs;
    team.runs += runs;
    
    if (type === 'wides' || type === 'noBalls') {
      ballTracker(team, type === 'wides' ? 'Wd' : 'Nb');
    } else {
      team.ballsDelivered += 1;
      team.overs = updateOvers(team.overs);
    }
    
    updateStorage(newData);
  };

  const updateOvers = (overs) => {
    const parsedOvers = parseFloat(overs) || 0;
    const whole = Math.floor(parsedOvers);
    const balls = Math.round((parsedOvers - whole) * 10);
    const newBalls = balls + 1;

    return newBalls === 6 ? whole + 1 : parseFloat(`${whole}.${newBalls}`);
  };

  const ballTracker = (team, value) => {
    if (!['Wd', 'Nb'].includes(value)) {
      team.currentOverBalls.push(value);
    }

    if (team.currentOverBalls.length === 6) {
      team.overHistory.push([...team.currentOverBalls]);
      team.currentOverBalls = [];
      const nextBowler = bowlers.find(b => b.id !== currentBowler)?.id || bowlers[0].id;
      setCurrentBowler(nextBowler);
    }
  };

  const simulateToss = () => {
    const tossWinner = Math.random() > 0.5 ? "teamA" : "teamB";
    const decision = Math.random() > 0.5 ? "bat" : "bowl";
    
    const newData = { ...matchData };
    newData.matchInfo.tossWinner = tossWinner;
    newData.matchInfo.tossDecision = decision;
    newData.currentInnings = decision === "bat" ? (tossWinner === "teamA" ? "A" : "B") : (tossWinner === "teamA" ? "B" : "A");
    
    // Reset batsmen and bowlers for new innings
    resetPlayers();
    
    updateStorage(newData);
  };

  const togglePowerplay = () => {
    const newData = { ...matchData };
    newData.matchSettings.isPowerplay = !newData.matchSettings.isPowerplay;
    updateStorage(newData);
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
    return `${overs}.${balls}`;
  };

  const getRunsAndBallsToWin = () => {
    if (matchData.currentInnings !== "B") return null;
    const target = matchData.teamA.runs + 1;
    const runsNeeded = target - matchData.teamB.runs;
    const ballsBowled = Math.floor(matchData.teamB.overs) * 6 + Math.round((matchData.teamB.overs % 1) * 10);
    const ballsLeft = Math.max(0, matchData.matchSettings.overLimit * 6 - ballsBowled);
    return { runsNeeded, ballsLeft };
  };

  const calculateCurrentRunRate = (teamKey = currentTeam) => {
    const t = matchData[teamKey];
    return t.overs > 0 ? (t.runs / t.overs).toFixed(2) : "0.00";
  };

  const getProjectedScore = () => {
    if (matchEnded || isAllOut) return null;
    const runRate = parseFloat(calculateCurrentRunRate()) || 0;
    const oversLeft = Math.max(0, matchData.matchSettings.overLimit - team.overs);
    return Math.round(team.runs + (runRate * oversLeft));
  };

  const endMatch = () => {
    const runsA = matchData.teamA.runs;
    const runsB = matchData.teamB.runs;
    const wicketsB = matchData.teamB.wickets;

    let winnerTeam = "";
    let winDetail = "";
    
    if (runsA > runsB) {
      winnerTeam = matchData.teamA.name;
      winDetail = `won by ${runsA - runsB} run${runsA - runsB !== 1 ? "s" : ""}`;
    } else if (runsB > runsA) {
      winnerTeam = matchData.teamB.name;
      const wicketsLeft = matchData.matchSettings.maxWickets - wicketsB;
      winDetail = `won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? "s" : ""}`;
    } else {
      winnerTeam = "It's a Tie!";
    }
    
    setWinner(`${winnerTeam} ${winDetail}`);
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
    setStriker(1);
    setNonStriker(2);
    setCurrentBowler(1);
  };

  const reset = () => {
    updateStorage(defaultState);
    setTimer(0);
    setMatchEnded(false);
    setWinner("");
    resetPlayers();
  };

  const switchInnings = () => {
    const newData = { ...matchData };
    newData.currentInnings = matchData.currentInnings === "A" ? "B" : "A";
    
    resetPlayers();
    updateStorage(newData);
  };

  return (
    <motion.div 
      className="bodyDiv"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h1 
        className="heading"
        whileHover={{ scale: 1.02 }}
      >
        Cricket Score Tracker
      </motion.h1>
      

      <motion.div 
        className="settings-btn" 
        onClick={() => setShowSettings(!showSettings)}
        whileTap={{ scale: 0.95 }}
      >
        {showSettings ? "Hide Settings" : "Settings"}
      </motion.div>

      {showSettings && (
        <motion.div 
          className="settings-panel"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <h3>Match Settings</h3>
          <div className="setting-item">
            <label>Overs per innings:</label>
            <input 
              type="number" 
              min="1" 
              max="50" 
              value={matchData.matchSettings.overLimit}
              onChange={e => {
                const newData = { ...matchData };
                newData.matchSettings.overLimit = Number(e.target.value);
                updateStorage(newData);
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
                const newData = { ...matchData };
                newData.matchSettings.maxWickets = Number(e.target.value);
                updateStorage(newData);
              }}
            />
          </div>
          <div className="setting-item">
            <label>Powerplay Overs:</label>
            <input 
              type="number" 
              min="1" 
              max={matchData.matchSettings.overLimit}
              value={matchData.matchSettings.powerplayOvers}
              onChange={e => {
                const newData = { ...matchData };
                newData.matchSettings.powerplayOvers = Number(e.target.value);
                updateStorage(newData);
              }}
            />
          </div>
          <motion.button 
            onClick={togglePowerplay}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {matchData.matchSettings.isPowerplay ? "End Powerplay" : "Start Powerplay"}
          </motion.button>
          <motion.button 
            onClick={() => {
              localStorage.removeItem("cricketScore");
              reset();
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Reset All Data
          </motion.button>
        </motion.div>
      )}

      <div className="matchTimer">
        Match Duration: <strong>{Math.floor(timer / 60)} mins {timer % 60} secs</strong>
        {matchData.matchSettings.isPowerplay && (
          <motion.span 
            className="powerplay-indicator"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            POWERPLAY
          </motion.span>
        )}
      </div>

      <div className="teamBox">
        {["teamA", "teamB"].map((teamKey) => (
          <motion.input
            key={teamKey}
            type="text"
            value={matchData[teamKey].name}
            onChange={(e) => {
              const newData = { ...matchData };
              newData[teamKey].name = e.target.value;
              updateStorage(newData);
            }}
            className={`teamDiv ${teamKey === currentTeam ? 'active-team' : ''}`}
            whileHover={{ scale: 1.01 }}
            whileFocus={{ scale: 1.02 }}
          />
        ))}
      </div>

      <motion.h2 
        className="InningHeading"
        whileHover={{ scale: 1.01 }}
      >
        {team.name} — <span className="text-green-700">Innings {matchData.currentInnings}</span>
      </motion.h2>

      <motion.div 
        className="teamScore"
        whileHover={{ scale: 1.01 }}
      >
        <div>Score: <strong>{team.runs}/{team.wickets}</strong></div>
        <div>Overs: <strong>{team.overs}</strong></div>
        <div>Run Rate: <strong>{calculateCurrentRunRate()}</strong></div>
        {!matchEnded && !isAllOut && <div>Projected: <strong>{getProjectedScore()}</strong></div>}
      </motion.div>

      {matchData.currentInnings === "B" && (
        <motion.div 
          className="targetScore"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
        >
          <h3>Target: <strong>{matchData.teamA.runs + 1}</strong></h3>
          <div className="runs-needed">
            {(() => {
              const info = getRunsAndBallsToWin();
              const reqRR = getRequiredRunRate();
              const oversLeft = getOversLeft();
              return info && info.runsNeeded > 0 && info.ballsLeft > 0 ? (
                <>
                  Needs <motion.span 
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >{info.runsNeeded}</motion.span> runs from <span>{info.ballsLeft}</span> balls
                  (<span>{oversLeft}</span> overs)<br />
                  Required RR: <span>{reqRR}</span>
                </>
              ) : null;
            })()}
          </div>
        </motion.div>
      )}

        {/* current over */}
      <motion.div 
        className="currentOver"
        whileHover={{ scale: 1.01 }}
      >
        <h3>Current Over:</h3>
        <div className="balls-container">
          {team.currentOverBalls.map((ball, idx) => (
            <motion.div 
              key={idx} 
              className={`ball ${ball === 'W' ? 'wicket' : ball === '4' || ball === '6' ? 'boundary' : ''}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              {ball}
            </motion.div>
          ))}
          {[...Array(Math.max(0, 6 - team.currentOverBalls.length))].map((_, i) => (
            <div key={i + 10} className="ball empty" />
          ))}
        </div>
      </motion.div>

      <div className="btnDiv">
        {[1, 2, 3, 4, 6].map((num) => (
          <motion.button 
            key={num} 
            onClick={() => addRun(num)} 
            className="runBtn" 
            disabled={isOverLimitReached || matchEnded || isAllOut}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            +{num}
          </motion.button>
        ))}
        <motion.button 
          onClick={() => addRun(0)} 
          className="runBtn" 
          disabled={isOverLimitReached || matchEnded || isAllOut}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          0
        </motion.button>
      </div>

      <div className="special-btns">
        <motion.button 
          onClick={() => addExtra('wides')} 
          className="WideBtn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isOverLimitReached || matchEnded || isAllOut}
        >
          Wide +1
        </motion.button>
        <motion.button 
          onClick={() => addExtra('noBalls')} 
          className="NoBallBtn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isOverLimitReached || matchEnded || isAllOut}
        >
          No Ball +1
        </motion.button>
        <motion.button 
          onClick={() => addExtra('byes')} 
          className="ByeBtn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isOverLimitReached || matchEnded || isAllOut}
        >
          Bye +1
        </motion.button>
        <motion.button 
          onClick={() => addExtra('legByes')} 
          className="LegByeBtn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isOverLimitReached || matchEnded || isAllOut}
        >
          Leg Bye +1
        </motion.button>
        <motion.button 
          onClick={addWicket} 
          className="wicketBtn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isOverLimitReached || matchEnded || isAllOut}
          animate={{ 
            scale: [1, 1.05, 1],
            backgroundColor: ['#c0392b', '#e74c3c', '#c0392b']
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Wicket
        </motion.button>
      </div>

      <div className="match-controls">
        {!matchEnded && (
          <motion.button 
            className="endMatchBtn" 
            onClick={endMatch}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            End Match
          </motion.button>
        )}
        <motion.button 
          onClick={switchInnings} 
          className="switchBtn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={matchEnded}
        >
          Switch Innings
        </motion.button>
        <motion.button 
          onClick={reset} 
          className="resetBtn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Reset Match
        </motion.button>
      </div>
      <motion.div 
        className="extras-summary"
        whileHover={{ scale: 1.01 }}
      >
        <h4>Extras:</h4>
        <div className="extras-grid">
          <div>Wides: {team.extras?.wides || 0}</div>
          <div>No Balls: {team.extras?.noBalls || 0}</div>
          <div>Byes: {team.extras?.byes || 0}</div>
          <div>Leg Byes: {team.extras?.legByes || 0}</div>
        </div>
      </motion.div>

      {matchEnded && (
        <motion.div 
          className="celebration"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <motion.h1 
            className="winnerHeading"
            animate={{
              color: ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            Match Over!
          </motion.h1>
          <motion.h2 
            className="winnerText"
            animate={{
              scale: [1, 1.05, 1],
              color: ['#2e7d32', '#27ae60', '#2e7d32'],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎉 {winner === "It's a Tie!" ? "Match Tied!" : winner} 🎉
          </motion.h2>
          <div className="match-summary">
            <h3>Match Summary</h3>
            <div className="summary-grid">
              <motion.div
                whileHover={{ scale: 1.02 }}
              >
                <h4>{matchData.teamA.name}</h4>
                <p>{matchData.teamA.runs}/{matchData.teamA.wickets} in {matchData.teamA.overs} overs</p>
                <p>RR: {calculateCurrentRunRate('teamA')}</p>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
              >
                <h4>{matchData.teamB.name}</h4>
                <p>{matchData.teamB.runs}/{matchData.teamB.wickets} in {matchData.teamB.overs} overs</p>
                <p>RR: {calculateCurrentRunRate('teamB')}</p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div 
        className="over-history"
        whileHover={{ scale: 1.01 }}
      >
        <h3>Over History</h3>
        {team.overHistory.length > 0 ? (
          <div className="overs-container">
            {team.overHistory.map((over, overIdx) => (
              <motion.div 
                key={overIdx} 
                className="over-item"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: overIdx * 0.05 }}
              >
                <div className="over-number">Over {overIdx + 1}</div>
                <div className="over-balls">
                  {over.map((ball, ballIdx) => (
                    <motion.span 
                      key={ballIdx} 
                      className={`ball ${ball === 'W' ? 'wicket' : ball === '4' || ball === '6' ? 'boundary' : ''}`}
                      whileHover={{ scale: 1.1 }}
                    >
                      {ball}
                    </motion.span>
                  ))}
                  {[...Array(Math.max(0, 6 - over.length))].map((_, i) => (
                    <span key={i + 20} className="ball empty" />
                  ))}
                </div>
                <div className="over-runs">
                  Runs: {over.reduce((sum, ball) => sum + (isNaN(ball) ? 0 : parseInt(ball)), 0)}
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
          <a target="_blank" rel="noopener noreferrer" href="https://www.linkedin.com/in/akshat-singhai-727bb5302/">
            LinkedIn Profile
          </a>
        </p>
      </div>
    </motion.div>
  );
};

export default ScoreBoard;