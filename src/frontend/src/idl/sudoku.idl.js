export const idlFactory = ({ IDL }) => {
  const CycleInfo = IDL.Record({
    cycleId: IDL.Int,
    cycleStart: IDL.Int,
    cycleEnd: IDL.Int,
  });
  return IDL.Service({
    getCurrentCycle: IDL.Func([], [CycleInfo], ["query"]),
    recordWin: IDL.Func([IDL.Text], [IDL.Bool], []),
    getMyWins: IDL.Func([], [IDL.Nat], ["query"]),
    haveIWon: IDL.Func([IDL.Text], [IDL.Bool], ["query"]),
    getWinsFor: IDL.Func([IDL.Principal], [IDL.Nat], ["query"]),
  });
};
