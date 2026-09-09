export const idlFactory = ({ IDL }) => {
  const BetKind = IDL.Variant({
    straight: IDL.Null,
    split: IDL.Null,
    street: IDL.Null,
    corner: IDL.Null,
    line: IDL.Null,
    column: IDL.Null,
    dozen: IDL.Null,
    redBlack: IDL.Null,
    oddEven: IDL.Null,
    highLow: IDL.Null,
  });
  const Bet = IDL.Record({
    id: IDL.Nat,
    player: IDL.Principal,
    playerName: IDL.Text,
    numbers: IDL.Vec(IDL.Nat),
    amount: IDL.Nat,
    kind: BetKind,
    betLabel: IDL.Text,
  });
  const Phase = IDL.Variant({
    idle: IDL.Null,
    betting: IDL.Null,
    spinning: IDL.Null,
    result: IDL.Null,
  });
  const RoundResult = IDL.Record({
    winningNumber: IDL.Nat,
    bets: IDL.Vec(Bet),
    winners: IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Text, IDL.Nat)),
    timestamp: IDL.Int,
  });
  const TableState = IDL.Record({
    phase: Phase,
    currentBets: IDL.Vec(Bet),
    roundEndsAt: IDL.Int,
    lastResult: IDL.Opt(RoundResult),
    history: IDL.Vec(RoundResult),
  });
  const ChatMsg = IDL.Record({
    id: IDL.Nat,
    sender: IDL.Principal,
    senderName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
  });
  return IDL.Service({
    placeBet: IDL.Func([IDL.Vec(IDL.Nat), IDL.Nat, BetKind, IDL.Text], [IDL.Bool], []),
    getTableState: IDL.Func([], [TableState], ["query"]),
    sendChat: IDL.Func([IDL.Text], [IDL.Bool], []),
    getChat: IDL.Func([], [IDL.Vec(ChatMsg)], ["query"]),
    isRedNumber: IDL.Func([IDL.Nat], [IDL.Bool], ["query"]),
  });
};
