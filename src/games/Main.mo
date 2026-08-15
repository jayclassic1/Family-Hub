import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Types "../shared/Types";

persistent actor {

  type GameScore = Types.GameScore;

  let scores = Map.empty<Nat, GameScore>();
  var scoreCounter : Nat = 0;

  public shared ({ caller }) func submitScore(playerName : Text, score : Nat) : async Nat {
    let id = scoreCounter;
    let gameScore : GameScore = {
      playerId = caller;
      playerName;
      score;
      timestamp = Time.now();
    };
    Map.add(scores, Nat.compare, id, gameScore);
    scoreCounter += 1;
    id
  };

  public query func getLeaderboard() : async [GameScore] {
    let allScores = Array.fromIter<GameScore>(Map.values(scores));
    let sorted = Array.sort<GameScore>(
      allScores,
      func(a : GameScore, b : GameScore) : { #less; #equal; #greater } {
        if (a.score > b.score) { #less }
        else if (a.score < b.score) { #greater }
        else { #equal }
      }
    );
    let limit = if (Array.size(sorted) > 10) { 10 } else { Array.size(sorted) };
    Array.tabulate<GameScore>(limit, func(i : Nat) : GameScore { sorted[i] })
  };
};
