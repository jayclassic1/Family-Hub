export const idlFactory = ({ IDL }) => {
  const RelationType = IDL.Variant({ parent: IDL.Null, spouse: IDL.Null });
  const TreeEdge = IDL.Record({
    id: IDL.Nat,
    from: IDL.Principal,
    to: IDL.Principal,
    relation: RelationType,
  });
  return IDL.Service({
    addParentChild: IDL.Func([IDL.Principal, IDL.Principal], [IDL.Nat], []),
    addSpouse: IDL.Func([IDL.Principal, IDL.Principal], [IDL.Nat], []),
    removeEdge: IDL.Func([IDL.Nat], [IDL.Bool], []),
    getAllEdges: IDL.Func([], [IDL.Vec(TreeEdge)], ["query"]),
  });
};
