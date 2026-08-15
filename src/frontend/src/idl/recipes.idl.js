export const idlFactory = ({ IDL }) => {
  const ChatAttachment = IDL.Record({
    filename: IDL.Text,
    contentType: IDL.Text,
    data: IDL.Vec(IDL.Nat8),
  });
  const Recipe = IDL.Record({
    id: IDL.Nat,
    creator: IDL.Principal,
    creatorName: IDL.Text,
    title: IDL.Text,
    description: IDL.Text,
    ingredients: IDL.Vec(IDL.Text),
    steps: IDL.Vec(IDL.Text),
    coverPhoto: IDL.Opt(ChatAttachment),
    created: IDL.Int,
  });
  const RecipeSummary = IDL.Record({
    recipe: Recipe,
    averageRating: IDL.Float64,
    ratingCount: IDL.Nat,
    myLoveGiven: IDL.Bool,
  });
  const RecipeComment = IDL.Record({
    id: IDL.Nat,
    recipeId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    rating: IDL.Opt(IDL.Nat),
    timestamp: IDL.Int,
  });
  const RecipeCommentPublic = IDL.Record({
    id: IDL.Nat,
    recipeId: IDL.Nat,
    author: IDL.Principal,
    authorName: IDL.Text,
    text: IDL.Text,
    rating: IDL.Opt(IDL.Nat),
    timestamp: IDL.Int,
    thumbsDownCount: IDL.Nat,
    myReaction: IDL.Opt(IDL.Bool),
    myLoveGiven: IDL.Bool,
  });
  const ChefSummary = IDL.Record({
    chef: IDL.Principal,
    chefName: IDL.Text,
    chefPhoto: IDL.Opt(ChatAttachment),
    recipeCount: IDL.Nat,
    totalRatings: IDL.Nat,
  });
  return IDL.Service({
    createRecipe: IDL.Func([IDL.Text, IDL.Text, IDL.Vec(IDL.Text), IDL.Vec(IDL.Text), IDL.Opt(ChatAttachment)], [IDL.Nat], []),
    deleteRecipe: IDL.Func([IDL.Nat], [IDL.Bool], []),
    listRecipes: IDL.Func([], [IDL.Vec(RecipeSummary)], ["query"]),
    getRecipe: IDL.Func([IDL.Nat], [IDL.Opt(RecipeSummary)], ["query"]),
    addComment: IDL.Func([IDL.Nat, IDL.Text, IDL.Opt(IDL.Nat)], [IDL.Nat], []),
    getComments: IDL.Func([IDL.Nat], [IDL.Vec(RecipeCommentPublic)], ["query"]),
    reactToComment: IDL.Func([IDL.Nat, IDL.Bool], [IDL.Bool], []),
    loveThisRecipe: IDL.Func([IDL.Nat], [IDL.Bool], []),
    loveThisComment: IDL.Func([IDL.Nat], [IDL.Bool], []),
    deleteComment: IDL.Func([IDL.Nat], [IDL.Bool], []),
    setChefPhoto: IDL.Func([ChatAttachment], [IDL.Bool], []),
    listChefs: IDL.Func([], [IDL.Vec(ChefSummary)], ["query"]),
    getChefSummary: IDL.Func([IDL.Principal], [IDL.Opt(ChefSummary)], ["query"]),
    getChefRecipes: IDL.Func([IDL.Principal], [IDL.Vec(RecipeSummary)], ["query"]),
  });
};
