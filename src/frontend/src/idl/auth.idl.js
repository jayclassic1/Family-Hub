export const idlFactory = ({ IDL }) => {
  const Role = IDL.Variant({ admin: IDL.Null, member: IDL.Null });
  const UserProfilePublic = IDL.Record({
    id: IDL.Principal,
    username: IDL.Text,
    role: Role,
    gender: IDL.Text,
    isInLaw: IDL.Bool,
    created: IDL.Int,
  });
  const AccessStatus = IDL.Record({
    isBanned: IDL.Bool,
    blockedUntil: IDL.Opt(IDL.Int),
  });
  const UserAccessInfo = IDL.Record({
    user: IDL.Principal,
    username: IDL.Text,
    isBanned: IDL.Bool,
    blockedUntil: IDL.Opt(IDL.Int),
  });
  return IDL.Service({
    register: IDL.Func([IDL.Text, IDL.Text], [IDL.Bool], []),
    claimAdminIfNoneExists: IDL.Func([], [IDL.Bool], []),
    isValidUser: IDL.Func([IDL.Principal], [IDL.Bool], ["query"]),
    getUser: IDL.Func([IDL.Principal], [IDL.Opt(UserProfilePublic)], ["query"]),
    getAllUsers: IDL.Func([], [IDL.Vec(UserProfilePublic)], ["query"]),
    getMyAccessStatus: IDL.Func([], [AccessStatus], ["query"]),
    setGender: IDL.Func([IDL.Text], [IDL.Bool], []),
    setIsInLaw: IDL.Func([IDL.Bool], [IDL.Bool], []),
    adminSetSignupPassword: IDL.Func([IDL.Text], [IDL.Bool], []),
    adminGetSignupPassword: IDL.Func([], [IDL.Opt(IDL.Text)], ["query"]),
    adminBan: IDL.Func([IDL.Principal], [IDL.Bool], []),
    adminUnban: IDL.Func([IDL.Principal], [IDL.Bool], []),
    adminBlock: IDL.Func([IDL.Principal, IDL.Nat], [IDL.Bool], []),
    adminUnblock: IDL.Func([IDL.Principal], [IDL.Bool], []),
    adminListAccessStatuses: IDL.Func([], [IDL.Vec(UserAccessInfo)], ["query"]),
  });
};
