import React, { useState, useEffect } from "react";
import "../components/ScoreBoard.css";

const ScoreBoard = () => {
  const defaultState = {
    teamA: { name: "Team A", runs: 0, wickets: 0, overs: 0, currentOverBalls: [], overHistory: [] },
    teamB: { name: "Team B", runs: 0, wickets: 0, overs: 0, currentOverBalls: [], overHistory: [] },
    currentInnings: "A"
  };

  const [matchData, setMatchData] = useState(() => {
    const saved = localStorage.getItem("cricketScore");
    return saved ? JSON.parse(saved) : defaultState;
  });

  const [timer, setTimer] = useState(0); // Match timer state
  const [matchEnded, setMatchEnded] = useState(false);
  const [winner, setWinner] = useState("");
  const [overLimit, setOverLimit] = useState(5); // User-customizable over limit

  useEffect(() => {
    const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentTeam = matchData.currentInnings === "A" ? "teamA" : "teamB";
  const team = matchData[currentTeam];

  // Helper to check if over limit reached
  const isOverLimitReached = team.overs >= overLimit;

  const updateStorage = (data) => {
    setMatchData(data);
    localStorage.setItem("cricketScore", JSON.stringify(data));
  };

  const addRun = (run) => {
    if (isOverLimitReached || matchEnded) return;
    const newData = { ...matchData };
    const team = newData[currentTeam];
    team.runs += run;
    team.ballsDelivered += 1;
    team.overs = updateOvers(team.overs);
    ballTracker(team, run.toString());
    updateStorage(newData);
  };

  const addWicket = () => {
    if (isOverLimitReached || matchEnded) return;
    const newData = { ...matchData };
    const team = newData[currentTeam];
    if (team.wickets < 10) {
      team.wickets += 1;
      team.ballsDelivered += 1;
      team.overs = updateOvers(team.overs);
      ballTracker(team, "W");
      updateStorage(newData);
    }
  };

  const addWide = () => {
    if (isOverLimitReached || matchEnded) return;
    const newData = { ...matchData };
    const team = newData[currentTeam];
    team.runs += 1;
    updateStorage(newData);
  };

  const addNoBall = () => {
    if (isOverLimitReached || matchEnded) return;
    const newData = { ...matchData };
    const team = newData[currentTeam];
    team.runs += 1;
    updateStorage(newData);
  };

  const updateOvers = (overs) => {
    const whole = Math.floor(overs);
    const balls = Math.round((overs - whole) * 10);
    const newBalls = balls + 1;

    if (newBalls === 6) return whole + 1;
    return parseFloat(`${whole}.${newBalls}`);
  };

  const ballTracker = (team, value) => {
    team.currentOverBalls.push(value);

    if (team.currentOverBalls.length === 6) {
      team.overHistory.push([...team.currentOverBalls]);
      team.currentOverBalls = [];
    }
  };

  const switchInnings = () => {
    const newData = { ...matchData, currentInnings: matchData.currentInnings === "A" ? "B" : "A" };
    updateStorage(newData);
  };

  const reset = () => {
    updateStorage(defaultState);
    setTimer(0); // Reset the timer
    setMatchEnded(false);
    setWinner("");
  };

  const handleTeamNameChange = (team, name) => {
    const newData = { ...matchData };
    newData[team].name = name;
    updateStorage(newData);
  };

  const inningEnd = () => {
    const newData = { ...matchData };
    const team = newData[currentTeam];
    team.overs = 0;
    team.runs = 0;
    team.wickets = 0;
    team.currentOverBalls = [];
    team.overHistory = [];
    newData.currentInnings = newData.currentInnings === "A" ? "B" : "A";
    updateStorage(newData);
  };

  // Function to calculate the target score
  const getTargetScore = () => {
    if (matchData.currentInnings === "B") {
      return matchData.teamA.runs + 1; // Target is Team A's score + 1
    }
    return null; // No target during the first innings
  };

  // Function to calculate the run rate for a specific over
  const calculateRunRatePerOver = (over) => {
    const totalRuns = over.reduce((sum, ball) => {
      if (ball === "W") return sum;
      return sum + (parseInt(ball, 10) || 0);
    }, 0);
    return totalRuns;
  };

 

  const calculateCurrentRunRate = () => {
    if (!team.overs || team.overs === 0) return "0.00";
    return (team.runs / team.overs).toFixed(2);
  };

  // Optionally, auto-end the innings if over limit is reached
  useEffect(() => {
    if (isOverLimitReached && !matchEnded) {
      // inningEnd(); // Uncomment to auto-end innings
    }
  }, [team.overs, matchEnded, isOverLimitReached]);
  const endMatch = () => {
  let winnerTeam = "";
  let winDetail = "";
  const runsA = matchData.teamA.runs;
  const runsB = matchData.teamB.runs;
  const wicketsB = matchData.teamB.wickets;

  if (runsA > runsB) {
    winnerTeam = matchData.teamA.name;
    winDetail = `won by ${runsA - runsB} run${runsA - runsB > 1 ? "s" : ""}`;
  } else if (runsB > runsA) {
    winnerTeam = matchData.teamB.name;
    winDetail = `won by ${10 - wicketsB} wicket${10 - wicketsB > 1 ? "s" : ""}`;
  } else {
    winnerTeam = "It's a Tie!";
    winDetail = "";
  }
  setWinner(`${winnerTeam} ${winDetail}`);
  setMatchEnded(true);
};

  return (
    <div className="bodyDiv">
      <h1 className="heading">Cricket Score App</h1>

      {/* Over Limit Input */}
      <div style={{ margin: "16px 0", textAlign: "center" }}>
        <label htmlFor="overLimit" style={{ fontWeight: "bold", marginRight: 8 }}>
          Set Over Limit:
        </label>
        <input
          id="overLimit"
          type="number"
          min={1}
          max={50}
          value={overLimit}
          onChange={e => setOverLimit(Number(e.target.value))}
          style={{
            width: 60,
            fontSize: "1.1rem",
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #457b9d",
            textAlign: "center"
          }}
          disabled={team.overs > 0 || matchEnded}
          title="Set before starting the innings"
        />
        <span style={{ marginLeft: 8, color: "#457b9d" }}>(Set before starting the innings)</span>
      </div>

      {/* Match Timer */}
      <div className="matchTimer">
        Match Duration: <strong>{Math.floor(timer / 60)} mins {timer % 60} secs</strong>
      </div>

      <div className="teamBox">
        {["teamA", "teamB"].map((teamKey) => (
          <input
            key={teamKey}
            type="text"
            value={matchData[teamKey].name}
            onChange={(e) => handleTeamNameChange(teamKey, e.target.value)}
            className="teamDiv"
          />
        ))}
      </div>

      <h2 className="InningHeading">
        {team.name} — <span className="text-green-700">Innings {matchData.currentInnings}</span>
      </h2>

      <div className="teamScore">
        Score: <strong> {team.runs}/{team.wickets} </strong> in <strong>{team.overs} overs</strong>
      </div>

      {/* Display Target Score */}
      {matchData.currentInnings === "B" && (
        <div className="targetScore">
          <h3>Target Score: <strong>{getTargetScore()}</strong></h3>
        </div>
      )}

      <div className="runRate" style={{ textAlign: "center", marginBottom: "16px", color: "#1d3557", fontWeight: "bold" }}>
        Current Run Rate: <span style={{ color: "#e63946" }}>{calculateCurrentRunRate()}</span>
      </div>

      {/* Over limit message */}
      {isOverLimitReached && !matchEnded && (
        <div style={{ color: "#e63946", fontWeight: "bold", margin: "16px 0", fontSize: "1.2rem" }}>
          Over limit reached ({overLimit} overs). Please end the innings or match.
        </div>
      )}

      {/* Current Over Display */}
      <div className="currentOver">
        <h3>Current Over:</h3>
        <div className="flex gap-2">
          {team.currentOverBalls.map((ball, idx) => (
            <div key={idx} className="w-6 h-6 flex items-center justify-center border rounded-full text-sm bg-gray-200">
              {ball}
            </div>
          ))}
          {[...Array(6 - team.currentOverBalls.length)].map((_, i) => (
            <div key={i + 10} className="w-6 h-6 border rounded-full bg-white" />
          ))}
        </div>
      </div>

      <div className="btnDiv">
        {[1, 2, 3, 4, 6].map((num) => (
          <button key={num} onClick={() => addRun(num)} className="runBtn" disabled={isOverLimitReached || matchEnded}>
            +{num}
          </button>
        ))}
        <button onClick={() => addRun(0)} className="runBtn" disabled={isOverLimitReached || matchEnded}>
          0
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button onClick={addWide} className="WideBtn" disabled={isOverLimitReached || matchEnded}>
          Wide +1
        </button>
        <button onClick={addNoBall} className="NoBallBtn" disabled={isOverLimitReached || matchEnded}>
          No Ball +1
        </button>
      </div>
      <button onClick={addWicket} className="wicketBtn" disabled={isOverLimitReached || matchEnded}>
        Wicket
      </button>
      {!matchEnded && (
        <div style={{ textAlign: "center", margin: "24px 0" }}>
          <button className="endMatchBtn" onClick={endMatch}>
            End Match
          </button>
        </div>
      )}

      {/* Winner Announcement */}
      {matchEnded && (
  <div className="celebration">
    <h1 className="winnerHeading">Match Over!</h1>
    <h2 className="winnerText">
    </h2>
    <h2 className="winnerText">
      🎉 {winner === "It's a Tie!" ? "No Winner" : winner} 🎉
    </h2>
  </div>
)}

      <div className="btnDiv">
        <button onClick={switchInnings} className="switchBtn">
          Switch Innings
        </button>
        <button onClick={reset} className="resetBtn">
          Reset
        </button>
        <button onClick={inningEnd} className="inningEndBtn">
          Inning End
        </button>
      </div>

      {/* Over History with Run Rate */}
      <div className="space-y-2 my-4">
        <h3 className="font-semibold text-lg mb-2">Over History</h3>
        {team && team.overHistory && team.overHistory.length > 0 ? (
          team.overHistory.map((over, overIdx) => (
            <div key={overIdx} className="flex items-center gap-2">
              <span className="w-16 font-medium">Over {overIdx + 1}:</span>
              {over.map((ball, ballIdx) => (
                <div
                  key={ballIdx}
                  className={`w-6 h-6 flex items-center justify-center border rounded-full text-sm ${
                    ball === "W" ? "bg-red-300" : ball === "4" || ball === "6" ? "bg-green-300" : "bg-gray-100"
                  }`}
                >
                  {ball}
                </div>
              ))}
              {[...Array(6 - over.length)].map((_, i) => (
                <div key={i + 20} className="w-6 h-6 border rounded-full bg-white" />
              ))}
              <span className="ml-4 text-sm text-blue-700 font-semibold">
                Run Rate: {calculateRunRatePerOver(over)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-gray-500">No over history available.</p>
        )}
      </div>
    </div>
  );
};

export default ScoreBoard;