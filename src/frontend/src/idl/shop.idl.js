export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const ShopProfile = IDL.Record({
    owner: IDL.Principal,
    nameColorOwned: IDL.Bool,
    nameColor: IDL.Text,
    nameFontOwned: IDL.Bool,
    nameFont: IDL.Text,
    pfpOwned: IDL.Bool,
    avatarPhoto: IDL.Opt(ChatAttachment),
    bannerOwned: IDL.Bool,
    bannerPhoto: IDL.Opt(ChatAttachment),
    chatBubbleOwned: IDL.Bool,
    chatBubbleSkin: IDL.Text,
    badgeOwned: IDL.Bool,
    badgeText: IDL.Text,
    profileThemeOwned: IDL.Bool,
    profileTheme: IDL.Text,
    lovedEffectsOwned: IDL.Vec(IDL.Text),
    lovedEffect: IDL.Text,
    sendEffectsOwned: IDL.Vec(IDL.Text),
    sendEffect: IDL.Text,
  });
  return IDL.Service({
    purchase: IDL.Func([IDL.Text], [IDL.Bool], []),
    setNameColor: IDL.Func([IDL.Text], [IDL.Bool], []),
    setNameFont: IDL.Func([IDL.Text], [IDL.Bool], []),
    setAvatarPhoto: IDL.Func([ChatAttachment], [IDL.Bool], []),
    setBannerPhoto: IDL.Func([ChatAttachment], [IDL.Bool], []),
    setChatBubbleSkin: IDL.Func([IDL.Text], [IDL.Bool], []),
    setBadgeText: IDL.Func([IDL.Text], [IDL.Bool], []),
    setProfileTheme: IDL.Func([IDL.Text], [IDL.Bool], []),
    setLovedEffect: IDL.Func([IDL.Text], [IDL.Bool], []),
    setSendEffect: IDL.Func([IDL.Text], [IDL.Bool], []),
    getMyShopProfile: IDL.Func([], [ShopProfile], ["query"]),
    getShopProfileFor: IDL.Func([IDL.Principal], [ShopProfile], ["query"]),
  });
};
