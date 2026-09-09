export const idlFactory = ({ IDL }) => {
  const RsvpResponse = IDL.Variant({ yes: IDL.Null, no: IDL.Null, maybe: IDL.Null });
  const EventKind = IDL.Variant({
    oneTime: IDL.Record({ dateMillis: IDL.Int }),
    annual: IDL.Record({ month: IDL.Nat, day: IDL.Nat }),
  });
  const Visibility = IDL.Variant({
    everyone: IDL.Null,
    selected: IDL.Vec(IDL.Principal),
  });
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const FamilyEvent = IDL.Record({
    id: IDL.Nat,
    creator: IDL.Principal,
    creatorName: IDL.Text,
    title: IDL.Text,
    description: IDL.Text,
    kind: EventKind,
    visibility: Visibility,
    coverPhoto: IDL.Opt(ChatAttachment),
    created: IDL.Int,
    allowRsvp: IDL.Bool,
  });
  const RsvpEntry = IDL.Record({ user: IDL.Principal, response: RsvpResponse });
  const EventComment = IDL.Record({
    id: IDL.Nat,
    eventId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
  });
  const EventCommentPublic = IDL.Record({
    id: IDL.Nat,
    eventId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    timestamp: IDL.Int,
    thumbsDownCount: IDL.Nat,
    myReaction: IDL.Opt(IDL.Bool),
    myLoveGiven: IDL.Bool,
  });
  const EventPhoto = IDL.Record({
    id: IDL.Nat,
    eventId: IDL.Nat,
    uploader: IDL.Principal,
    uploaderName: IDL.Text,
    photo: ChatAttachment,
    timestamp: IDL.Int,
  });
  return IDL.Service({
    createEvent: IDL.Func([IDL.Text, IDL.Text, EventKind, Visibility, IDL.Opt(ChatAttachment), IDL.Bool], [IDL.Nat], []),
    deleteEvent: IDL.Func([IDL.Nat], [IDL.Bool], []),
    getVisibleEvents: IDL.Func([], [IDL.Vec(FamilyEvent)], ["query"]),
    getEvent: IDL.Func([IDL.Nat], [IDL.Opt(FamilyEvent)], ["query"]),
    rsvp: IDL.Func([IDL.Nat, RsvpResponse], [IDL.Bool], []),
    getRsvps: IDL.Func([IDL.Nat], [IDL.Vec(RsvpEntry)], ["query"]),
    getMyRsvp: IDL.Func([IDL.Nat], [IDL.Opt(RsvpResponse)], ["query"]),
    addEventComment: IDL.Func([IDL.Nat, IDL.Text], [IDL.Nat], []),
    getEventComments: IDL.Func([IDL.Nat], [IDL.Vec(EventCommentPublic)], ["query"]),
    reactToEventComment: IDL.Func([IDL.Nat, IDL.Bool], [IDL.Bool], []),
    loveThisEvent: IDL.Func([IDL.Nat], [IDL.Bool], []),
    getMyEventLoveGiven: IDL.Func([IDL.Nat], [IDL.Bool], ["query"]),
    loveThisEventComment: IDL.Func([IDL.Nat], [IDL.Bool], []),
    deleteEventComment: IDL.Func([IDL.Nat], [IDL.Bool], []),
    uploadEventPhoto: IDL.Func([IDL.Nat, ChatAttachment], [IDL.Nat], []),
    getEventPhotos: IDL.Func([IDL.Nat], [IDL.Vec(EventPhoto)], ["query"]),
  });
};
