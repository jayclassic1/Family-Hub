export const idlFactory = ({ IDL }) => {
  const Suit = IDL.Variant({
    hearts: IDL.Null,
    diamonds: IDL.Null,
    clubs: IDL.Null,
    spades: IDL.Null,
  });
  const Card = IDL.Record({
    rank: IDL.Nat,
    suit: Suit,
  });
  const Phase = IDL.Variant({
    waiting: IDL.Null,
    preflop: IDL.Null,
    flop: IDL.Null,
    turn: IDL.Null,
    river: IDL.Null,
    showdown: IDL.Null,
    handComplete: IDL.Null,
  });
  const SeatState = IDL.Record({
    player: IDL.Principal,
    playerName: IDL.Text,
    stack: IDL.Nat,
    holeCards: IDL.Vec(Card),
    betThisRound: IDL.Nat,
    betThisHand: IDL.Nat,
    folded: IDL.Bool,
    allIn: IDL.Bool,
    hasActed: IDL.Bool,
    inHand: IDL.Bool,
    missedTurns: IDL.Nat,
  });
  const Table = IDL.Record({
    id: IDL.Nat,
    name: IDL.Text,
    creator: IDL.Principal,
    maxSeats: IDL.Nat,
    seats: IDL.Vec(IDL.Opt(SeatState)),
    community: IDL.Vec(Card),
    deck: IDL.Vec(Card),
    pot: IDL.Nat,
    phase: Phase,
    dealerSeat: IDL.Nat,
    toActSeat: IDL.Nat,
    currentBet: IDL.Nat,
    handNumber: IDL.Nat,
    lastAction: IDL.Text,
    winnerText: IDL.Text,
  });
  return IDL.Service({
    createTable: IDL.Func([IDL.Text, IDL.Nat], [IDL.Nat], []),
    listTables: IDL.Func([], [IDL.Vec(Table)], ["query"]),
    getTable: IDL.Func([IDL.Nat], [IDL.Opt(Table)], ["query"]),
    joinTable: IDL.Func([IDL.Nat, IDL.Nat, IDL.Nat], [IDL.Bool], []),
    leaveTable: IDL.Func([IDL.Nat], [IDL.Bool], []),
    act: IDL.Func([IDL.Nat, IDL.Text, IDL.Nat], [IDL.Bool], []),
    startNextHand: IDL.Func([IDL.Nat], [IDL.Bool], []),
    skipInactivePlayer: IDL.Func([IDL.Nat], [IDL.Bool], []),
  });
};
