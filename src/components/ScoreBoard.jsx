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



  useEffect(() => {

    const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);

    return () => clearInterval(interval);

  }, []);



  const currentTeam = matchData.currentInnings === "A" ? "teamA" : "teamB";



  const updateStorage = (data) => {

    setMatchData(data);

    localStorage.setItem("cricketScore", JSON.stringify(data));

  };



  const addRun = (run) => {

    const newData = { ...matchData };

    const team = newData[currentTeam];

    team.runs += run;

    team.ballsDelivered += 1;

    team.overs = updateOvers(team.overs);

    ballTracker(team, run.toString());

    updateStorage(newData);

  };



  const addWicket = () => {

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

  };



  const handleTeamNameChange = (team, name) => {

    const newData = { ...matchData };

    newData[team].name = name;

    updateStorage(newData);

  };



  const addWide = () => {

    const newData = { ...matchData };

    const team = newData[currentTeam];

    team.runs += 1;

    updateStorage(newData);

  };



  const addNoBall = () => {

    const newData = { ...matchData };

    const team = newData[currentTeam];

    team.runs += 1;

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



  const team = matchData[currentTeam];

  



  return (

    <div className="bodyDiv">

      <h1 className="heading">Cricket Score App</h1>



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

          <button key={num} onClick={() => addRun(num)} className="runBtn">

            +{num}

          </button>

        ))}

        <button onClick={() => addRun(0)} className="runBtn">

          0

        </button>

      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">

        <button onClick={addWide} className="WideBtn">

          Wide +1

        </button>

        <button onClick={addNoBall} className="NoBallBtn">

          No Ball +1

        </button>

      </div>

      <button onClick={addWicket} className="wicketBtn">

        Wicket

      </button>



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



   <div className="space-y-2 my-4">

  <h3 className="font-semibold text-lg mb-2">Over History</h3>

  {team && team.overHistory && team.overHistory.length > 0 ? ( // Add safe checks for team and overHistory

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

      </div>

    ))

  ) : (

    <p className="text-gray-500">No over history available.</p> // Fallback message

  )}

</div>

    </div>

  );

};



export default ScoreBoard;