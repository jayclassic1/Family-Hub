module {
  public type UserId = Principal;
  public type EventId = Nat;
  public type TaskId = Nat;
  public type GameId = Nat;
  public type MessageId = Nat;
  public type EdgeId = Nat;
  public type GroupId = Nat;
  public type PollId = Nat;
  public type CommentId = Nat;
  public type PhotoId = Nat;
  public type AlbumId = Nat;
  public type SpinId = Nat;
  public type HatDrawId = Nat;
  public type SantaId = Nat;
  public type ChessGameId = Nat;
  public type RpsGameId = Nat;
  public type StrawGameId = Nat;
  public type RecipeId = Nat;
  public type LedgerId = Nat;
  public type ExpenseId = Nat;

  public type UserProfile = {
    id : UserId;
    var username : Text;
    var role : { #admin; #member };
    var gender : Text;
    var isInLaw : Bool;
    created : Int;
  };

  public type UserProfilePublic = {
    id : UserId;
    username : Text;
    role : { #admin; #member };
    gender : Text;
    isInLaw : Bool;
    created : Int;
  };

  public type FamilyTask = {
    id : TaskId;
    title : Text;
    var completed : Bool;
    assignedTo : UserId;
    creator : UserId;
    dueDate : ?Int;
  };

  public type FamilyTaskPublic = {
    id : TaskId;
    title : Text;
    completed : Bool;
    assignedTo : UserId;
    creator : UserId;
    dueDate : ?Int;
  };

  public type GameScore = {
    playerId : UserId;
    playerName : Text;
    score : Nat;
    timestamp : Int;
  };

  public type ChatAttachment = {
    filename : Text;
    contentType : Text;
    data : Blob;
  };

  public type ChatMessage = {
    id : MessageId;
    sender : UserId;
    senderName : Text;
    text : Text;
    attachment : ?ChatAttachment;
    timestamp : Int;
    shareType : ?Text;
    shareTitle : ?Text;
    shareLink : ?Text;
    animated : Bool;
    isBanner : Bool;
    isPinned : Bool;
  };

  public type ChatMessagePublic = {
    id : MessageId;
    sender : UserId;
    senderName : Text;
    text : Text;
    attachment : ?ChatAttachment;
    timestamp : Int;
    thumbsDownCount : Nat;
    thumbsUpCount : Nat;
    loveCount : Nat;
    myReaction : ?Bool;
    myLoveGiven : Bool;
    shareType : ?Text;
    shareTitle : ?Text;
    shareLink : ?Text;
    animated : Bool;
    isBanner : Bool;
    isPinned : Bool;
  };

  public type DmMessage = {
    id : MessageId;
    sender : UserId;
    senderName : Text;
    recipient : UserId;
    text : Text;
    attachment : ?ChatAttachment;
    timestamp : Int;
  };

  public type DmMessagePublic = {
    id : MessageId;
    sender : UserId;
    senderName : Text;
    recipient : UserId;
    text : Text;
    attachment : ?ChatAttachment;
    timestamp : Int;
    thumbsDownCount : Nat;
    myReaction : ?Bool;
    myLoveGiven : Bool;
  };

  public type RelationType = { #parent; #spouse };

  public type TreeEdge = {
    id : EdgeId;
    from : UserId;
    to : UserId;
    relation : RelationType;
  };

  public type Group = {
    id : GroupId;
    name : Text;
    description : Text;
    creator : UserId;
    isPublic : Bool;
    created : Int;
    restrictedKey : ?Text;
  };

  public type GroupMessage = {
    id : MessageId;
    groupId : GroupId;
    sender : UserId;
    senderName : Text;
    text : Text;
    attachment : ?ChatAttachment;
    timestamp : Int;
  };

  public type GroupMessagePublic = {
    id : MessageId;
    groupId : GroupId;
    sender : UserId;
    senderName : Text;
    text : Text;
    attachment : ?ChatAttachment;
    timestamp : Int;
    thumbsDownCount : Nat;
    myReaction : ?Bool;
    myLoveGiven : Bool;
  };

  public type Poll = {
    id : PollId;
    creator : UserId;
    creatorName : Text;
    title : Text;
    description : Text;
    options : [Text];
    optionUsers : [?UserId];
    coverPhoto : ?ChatAttachment;
    created : Int;
  };

  public type PollSummary = {
    poll : Poll;
    counts : [Nat];
    myLoveGiven : Bool;
  };

  public type PollComment = {
    id : CommentId;
    pollId : PollId;
    author : UserId;
    authorName : Text;
    text : Text;
    timestamp : Int;
  };

  public type PollCommentPublic = {
    id : CommentId;
    pollId : PollId;
    author : UserId;
    authorName : Text;
    text : Text;
    timestamp : Int;
    thumbsDownCount : Nat;
    myReaction : ?Bool;
    myLoveGiven : Bool;
  };

  public type EventKind = {
    #oneTime : { dateMillis : Int };
    #annual : { month : Nat; day : Nat };
  };

  public type Visibility = {
    #everyone;
    #selected : [UserId];
  };

  public type RsvpResponse = { #yes; #no; #maybe };

  public type FamilyEvent = {
    id : EventId;
    creator : UserId;
    creatorName : Text;
    title : Text;
    description : Text;
    kind : EventKind;
    visibility : Visibility;
    coverPhoto : ?ChatAttachment;
    created : Int;
  };

  public type RsvpEntry = {
    user : UserId;
    response : RsvpResponse;
  };

  public type EventComment = {
    id : CommentId;
    eventId : EventId;
    author : UserId;
    authorName : Text;
    text : Text;
    timestamp : Int;
  };

  public type EventCommentPublic = {
    id : CommentId;
    eventId : EventId;
    author : UserId;
    authorName : Text;
    text : Text;
    timestamp : Int;
    thumbsDownCount : Nat;
    myReaction : ?Bool;
    myLoveGiven : Bool;
  };

  public type EventPhoto = {
    id : PhotoId;
    eventId : EventId;
    uploader : UserId;
    uploaderName : Text;
    photo : ChatAttachment;
    timestamp : Int;
  };

  public type Album = {
    id : AlbumId;
    name : Text;
    description : Text;
    creator : UserId;
    creatorName : Text;
    contributors : [UserId];
    coverPhoto : ?ChatAttachment;
    created : Int;
  };

  public type AlbumSummary = {
    album : Album;
    myLoveGiven : Bool;
  };

  public type AlbumPhotoPublic = {
    id : PhotoId;
    albumId : AlbumId;
    uploader : UserId;
    uploaderName : Text;
    photo : ChatAttachment;
    likeCount : Nat;
    likedByMe : Bool;
    timestamp : Int;
  };

  public type SpinResult = {
    id : SpinId;
    spinner : UserId;
    spinnerName : Text;
    options : [Text];
    winner : Text;
    name : Text;
    description : Text;
    coverPhoto : ?ChatAttachment;
    created : Int;
  };

  public type SpinComment = {
    id : CommentId;
    spinId : SpinId;
    author : UserId;
    authorName : Text;
    text : Text;
    timestamp : Int;
  };

  public type HatAssignment = {
    participant : Text;
    answer : Text;
  };

  public type HatDraw = {
    id : HatDrawId;
    drawer : UserId;
    drawerName : Text;
    answers : [Text];
    assignments : [HatAssignment];
    name : Text;
    description : Text;
    coverPhoto : ?ChatAttachment;
    created : Int;
  };

  public type HatComment = {
    id : CommentId;
    drawId : HatDrawId;
    author : UserId;
    authorName : Text;
    text : Text;
    timestamp : Int;
  };

  public type SecretSantaExchange = {
    id : SantaId;
    organizer : UserId;
    organizerName : Text;
    name : Text;
    description : Text;
    participants : [UserId];
    coverPhoto : ?ChatAttachment;
    created : Int;
  };

  public type SantaMatch = {
    recipientId : UserId;
    recipientName : Text;
  };

  public type SantaComment = {
    id : CommentId;
    santaId : SantaId;
    author : UserId;
    authorName : Text;
    text : Text;
    timestamp : Int;
  };

  public type ChessStatus = {
    #ongoing;
    #whiteWon;
    #blackWon;
    #draw;
    #resignedWhite;
    #resignedBlack;
  };

  public type ChessGame = {
    id : ChessGameId;
    white : UserId;
    whiteName : Text;
    black : ?UserId;
    blackName : ?Text;
    isOpen : Bool;
    invitedPlayer : ?UserId;
    invitedName : ?Text;
    fen : Text;
    moveHistory : [Text];
    status : ChessStatus;
    turnIsWhite : Bool;
    created : Int;
    lastMoveAt : Int;
    wager : Nat;
    wagerPaidOut : Bool;
  };

  public type RpsChoice = { #rock; #paper; #scissors };

  public type RpsStatus = {
    #waitingForOpponent;
    #waitingForChoices;
    #finished;
  };

  public type RpsGamePublic = {
    id : RpsGameId;
    creator : UserId;
    creatorName : Text;
    opponent : ?UserId;
    opponentName : ?Text;
    status : RpsStatus;
    creatorChoice : ?RpsChoice;
    opponentChoice : ?RpsChoice;
    winner : ?UserId;
    winnerName : ?Text;
    isDraw : Bool;
    round : Nat;
    name : ?Text;
    description : ?Text;
    coverPhoto : ?ChatAttachment;
    created : Int;
  };

  public type RpsComment = {
    id : CommentId;
    gameId : RpsGameId;
    author : UserId;
    authorName : Text;
    text : Text;
    timestamp : Int;
  };

  public type StrawResultPublic = {
    participant : UserId;
    participantName : Text;
    revealed : Bool;
    isShort : ?Bool;
  };

  public type StrawGame = {
    id : StrawGameId;
    creator : UserId;
    creatorName : Text;
    name : Text;
    description : Text;
    participants : [UserId];
    shortStrawCount : Nat;
    coverPhoto : ?ChatAttachment;
    created : Int;
  };

  public type StrawComment = {
    id : CommentId;
    gameId : StrawGameId;
    author : UserId;
    authorName : Text;
    text : Text;
    timestamp : Int;
  };

  public type Recipe = {
    id : RecipeId;
    creator : UserId;
    creatorName : Text;
    title : Text;
    description : Text;
    ingredients : [Text];
    steps : [Text];
    coverPhoto : ?ChatAttachment;
    created : Int;
  };

  public type RecipeSummary = {
    recipe : Recipe;
    averageRating : Float;
    ratingCount : Nat;
    myLoveGiven : Bool;
  };

  public type RecipeComment = {
    id : CommentId;
    recipeId : RecipeId;
    author : UserId;
    authorName : Text;
    text : Text;
    rating : ?Nat;
    timestamp : Int;
  };

  public type RecipeCommentPublic = {
    id : CommentId;
    recipeId : RecipeId;
    author : UserId;
    authorName : Text;
    text : Text;
    rating : ?Nat;
    timestamp : Int;
    thumbsDownCount : Nat;
    myReaction : ?Bool;
    myLoveGiven : Bool;
  };

  public type ChefSummary = {
    chef : UserId;
    chefName : Text;
    chefPhoto : ?ChatAttachment;
    recipeCount : Nat;
    totalRatings : Nat;
  };

  public type ProfileDetails = {
    owner : UserId;
    address : ?Text;
    postalCode : ?Text;
    telephone : ?Text;
    whatsapp : ?Text;
    email : ?Text;
    description : ?Text;
    photos : [ChatAttachment];
    totalLikes : Nat;
  };

  public type ETransferContact = {
    id : Nat;
    name : Text;
    email : Text;
  };

  public type Ledger = {
    id : LedgerId;
    name : Text;
    description : Text;
    creator : UserId;
    creatorName : Text;
    participants : [UserId];
    created : Int;
  };

  public type Expense = {
    id : ExpenseId;
    ledgerId : LedgerId;
    description : Text;
    amount : Float;
    paidBy : UserId;
    paidByName : Text;
    splitAmong : [UserId];
    created : Int;
  };

  public type Balance = {
    user : UserId;
    netAmount : Float;
  };

  public type Debt = {
    id : Nat;
    description : Text;
    counterparty : Text;
    amount : Float;
    isOwedByMe : Bool;
    isPaid : Bool;
    created : Int;
  };

  public type AlbumPhotoMeta = {
    id : PhotoId;
    albumId : AlbumId;
    uploader : UserId;
    uploaderName : Text;
    filename : Text;
    contentType : Text;
    thumbsDownCount : Nat;
    myReaction : ?Bool;
    timestamp : Int;
    myLoveGiven : Bool;
  };
};
