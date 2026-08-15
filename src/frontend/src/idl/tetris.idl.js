export const idlFactory = ({ IDL }) => {
  const TournamentStatus = IDL.Variant({
    waiting: IDL.Null,
    inProgress: IDL.Null,
    complete: IDL.Null,
    cancelled: IDL.Null,
  });
  const PlayerEntry = IDL.Record({
    player: IDL.Principal,
    playerName: IDL.Text,
    score: IDL.Opt(IDL.Nat),
  });
  const Tournament = IDL.Record({
    id: IDL.Nat,
    creator: IDL.Principal,
    name: IDL.Text,
    maxPlayers: IDL.Nat,
    wager: IDL.Nat,
    players: IDL.Vec(PlayerEntry),
    status: TournamentStatus,
    winnerText: IDL.Text,
    created: IDL.Int,
  });
  const HighScore = IDL.Record({
    player: IDL.Principal,
    playerName: IDL.Text,
    score: IDL.Nat,
    timestamp: IDL.Int,
  });
  return IDL.Service({
    createTournament: IDL.Func([IDL.Text, IDL.Nat, IDL.Nat], [IDL.Nat], []),
    joinTournament: IDL.Func([IDL.Nat], [IDL.Bool], []),
    startTournament: IDL.Func([IDL.Nat], [IDL.Bool], []),
    cancelTournament: IDL.Func([IDL.Nat], [IDL.Bool], []),
    submitScore: IDL.Func([IDL.Nat, IDL.Nat], [IDL.Bool], []),
    listTournaments: IDL.Func([], [IDL.Vec(Tournament)], ["query"]),
    getTournament: IDL.Func([IDL.Nat], [IDL.Opt(Tournament)], ["query"]),
    recordHighScore: IDL.Func([IDL.Nat], [IDL.Bool], []),
    getTopScores: IDL.Func([IDL.Nat], [IDL.Vec(HighScore)], ["query"]),
  });
};
