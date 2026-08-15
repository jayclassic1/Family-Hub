export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const ListingStatus = IDL.Variant({
    active: IDL.Null,
    sold: IDL.Null,
    cancelled: IDL.Null,
  });
  const Bid = IDL.Record({
    bidder: IDL.Principal,
    bidderName: IDL.Text,
    amount: IDL.Nat,
    timestamp: IDL.Int,
  });
  const ListingSummary = IDL.Record({
    id: IDL.Nat,
    seller: IDL.Principal,
    sellerName: IDL.Text,
    title: IDL.Text,
    description: IDL.Text,
    photoCount: IDL.Nat,
    lovePrice: IDL.Opt(IDL.Nat),
    offsiteNote: IDL.Text,
    bids: IDL.Vec(Bid),
    status: ListingStatus,
    created: IDL.Int,
  });
  return IDL.Service({
    createListing: IDL.Func([IDL.Text, IDL.Text, IDL.Opt(IDL.Nat), IDL.Text], [IDL.Nat], []),
    addListingPhoto: IDL.Func([IDL.Nat, ChatAttachment], [IDL.Bool], []),
    removeListingPhoto: IDL.Func([IDL.Nat, IDL.Nat], [IDL.Bool], []),
    listListings: IDL.Func([], [IDL.Vec(ListingSummary)], ["query"]),
    getListing: IDL.Func([IDL.Nat], [IDL.Opt(ListingSummary)], ["query"]),
    getListingPhoto: IDL.Func([IDL.Nat, IDL.Nat], [IDL.Opt(ChatAttachment)], ["query"]),
    buyNow: IDL.Func([IDL.Nat], [IDL.Bool], []),
    placeBid: IDL.Func([IDL.Nat, IDL.Nat], [IDL.Bool], []),
    acceptBid: IDL.Func([IDL.Nat, IDL.Principal], [IDL.Bool], []),
    markSold: IDL.Func([IDL.Nat], [IDL.Bool], []),
    cancelListing: IDL.Func([IDL.Nat], [IDL.Bool], []),
  });
};
