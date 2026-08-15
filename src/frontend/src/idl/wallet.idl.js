export const idlFactory = ({ IDL }) => {
  const ETransferContact = IDL.Record({
    id: IDL.Nat,
    name: IDL.Text,
    email: IDL.Text,
  });
  const Ledger = IDL.Record({
    id: IDL.Nat,
    name: IDL.Text,
    description: IDL.Text,
    creator: IDL.Principal,
    creatorName: IDL.Text,
    participants: IDL.Vec(IDL.Principal),
    created: IDL.Int,
  });
  const Expense = IDL.Record({
    id: IDL.Nat,
    ledgerId: IDL.Nat,
    description: IDL.Text,
    amount: IDL.Float64,
    paidBy: IDL.Principal,
    paidByName: IDL.Text,
    splitAmong: IDL.Vec(IDL.Principal),
    created: IDL.Int,
  });
  const Balance = IDL.Record({
    user: IDL.Principal,
    netAmount: IDL.Float64,
  });
  const Debt = IDL.Record({
    id: IDL.Nat,
    description: IDL.Text,
    counterparty: IDL.Text,
    amount: IDL.Float64,
    isOwedByMe: IDL.Bool,
    isPaid: IDL.Bool,
    created: IDL.Int,
  });
  return IDL.Service({
    addContact: IDL.Func([IDL.Text, IDL.Text], [IDL.Nat], []),
    removeContact: IDL.Func([IDL.Nat], [IDL.Bool], []),
    listContacts: IDL.Func([], [IDL.Vec(ETransferContact)], ["query"]),
    createLedger: IDL.Func([IDL.Text, IDL.Text, IDL.Vec(IDL.Principal)], [IDL.Nat], []),
    addParticipant: IDL.Func([IDL.Nat, IDL.Principal], [IDL.Bool], []),
    listMyLedgers: IDL.Func([], [IDL.Vec(Ledger)], ["query"]),
    getLedger: IDL.Func([IDL.Nat], [IDL.Opt(Ledger)], ["query"]),
    addExpense: IDL.Func([IDL.Nat, IDL.Text, IDL.Float64, IDL.Principal, IDL.Vec(IDL.Principal)], [IDL.Nat], []),
    deleteExpense: IDL.Func([IDL.Nat], [IDL.Bool], []),
    getExpenses: IDL.Func([IDL.Nat], [IDL.Vec(Expense)], ["query"]),
    getBalances: IDL.Func([IDL.Nat], [IDL.Vec(Balance)], ["query"]),
    addDebt: IDL.Func([IDL.Text, IDL.Text, IDL.Float64, IDL.Bool], [IDL.Nat], []),
    toggleDebtPaid: IDL.Func([IDL.Nat], [IDL.Bool], []),
    removeDebt: IDL.Func([IDL.Nat], [IDL.Bool], []),
    listDebts: IDL.Func([], [IDL.Vec(Debt)], ["query"]),
    earnLoveFor: IDL.Func([IDL.Principal, IDL.Nat], [IDL.Bool], []),
    spendLove: IDL.Func([IDL.Nat], [IDL.Bool], []),
    spendLoveFor: IDL.Func([IDL.Principal, IDL.Nat], [IDL.Bool], []),
    transferLove: IDL.Func([IDL.Principal, IDL.Nat], [IDL.Bool], []),
    transferLoveBetween: IDL.Func([IDL.Principal, IDL.Principal, IDL.Nat], [IDL.Bool], []),
    getMyLove: IDL.Func([], [IDL.Nat], ["query"]),
  });
};
