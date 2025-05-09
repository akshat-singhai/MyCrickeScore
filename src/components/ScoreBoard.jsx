import React, { useState, useEffect } from "react";
import "../components/ScoreBoard.css";
import image from "../assets/bgimage3.jpeg";
const ScoreBoard = () => {
  const defaultState = {
    teamA: { name: "Team A", runs: 0, wickets: 0, overs: 0 },
    teamB: { name: "Team B", runs: 0, wickets: 0, overs: 0 },
    currentInnings: "A"
  };

  const [matchData, setMatchData] = useState(() => {
    const saved = localStorage.getItem("cricketScore");
    return saved ? JSON.parse(saved) : defaultState;
  });

  const currentTeam = matchData.currentInnings === "A" ? "teamA" : "teamB";

  const updateStorage = (data) => {
    setMatchData(data);
    localStorage.setItem("cricketScore", JSON.stringify(data));
  };

  const addRun = (run) => {
    const newData = { ...matchData };
    newData[currentTeam].runs += run;
    newData[currentTeam].overs = updateOvers(newData[currentTeam].overs);
    updateStorage(newData);
  };

  const addWicket = () => {
    const newData = { ...matchData };
    if (newData[currentTeam].wickets < 10) {
      newData[currentTeam].wickets += 1;
      newData[currentTeam].overs = updateOvers(newData[currentTeam].overs);
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

  const switchInnings = () => {
    const newData = { ...matchData, currentInnings: matchData.currentInnings === "A" ? "B" : "A" };
    updateStorage(newData);
  };

  const reset = () => {
    updateStorage(defaultState);
  };

  const handleTeamNameChange = (team, name) => {
    const newData = { ...matchData };
    newData[team].name = name;
    updateStorage(newData);
  };
  const addWide = () => {
    const newData = { ...matchData };
    newData[currentTeam].runs += 1;
    updateStorage(newData);
  
  };

  const addNoBall = () => {
    const newData = { ...matchData };
    newData[currentTeam].runs += 1;
    updateStorage(newData);
   
  };
  const inningEnd = () => {
    const newData = { ...matchData };
    newData[currentTeam].overs = 0;
    newData[currentTeam].runs = 0;
    newData[currentTeam].wickets = 0;
    newData.currentInnings = newData.currentInnings === "A" ? "B" : "A";
    updateStorage(newData);
  };
  const team = matchData[currentTeam];

  return (
    <div className="bgImage" style={{ backgroundImage: `url(${image})` }}>
    <div className="bodyDiv" >
   
      <h1 className="heading">Cricket Score App</h1>
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


      <div className="btnDiv">
        {[1, 2, 3, 4, 6].map((num) => (
          <button
            key={num}
            onClick={() => addRun(num)}
            className="runBtn"
          >
            +{num}
          </button>
        ))}
        <button
          onClick={() => addRun(0)}
          className="runBtn" > 0 </button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={addWide}
          className="WideBtn"
        >
          Wide +1
      
        </button>
        <button
          onClick={addNoBall}
          className="NoBallBtn"
        >
          No Ball +1
        </button>
      </div>
      <button
        onClick={addWicket}
        className="wicketBtn"
      >
        Wicket
      </button>

      <div className="btnDiv">
        <button
          onClick={switchInnings}
          className="switchBtn"
        >
          Switch Innings
        </button>
        <button
          onClick={reset}
          className="resetBtn"
        >
          Reset
        </button>
        <button onClick={inningEnd}
          className="inningEndBtn">
          Inning End
        </button>
        

      </div>
    </div>
    </div>
  );
};

export default ScoreBoard;
