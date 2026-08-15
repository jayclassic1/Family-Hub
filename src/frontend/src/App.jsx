import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav.jsx";
import TopBar from "./components/TopBar.jsx";
import AuthGate from "./components/AuthGate.jsx";
import { TopBarActionsProvider } from "./context/TopBarActionsContext.jsx";
import Home from "./pages/Home.jsx";
import Events from "./pages/Events.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import Albums from "./pages/Albums.jsx";
import AlbumDetail from "./pages/AlbumDetail.jsx";
import Games from "./pages/Games.jsx";
import SpinWheel from "./pages/games/SpinWheel.jsx";
import SpinResults from "./pages/games/SpinResults.jsx";
import SpinDetail from "./pages/games/SpinDetail.jsx";
import HatGame from "./pages/games/HatGame.jsx";
import HatResults from "./pages/games/HatResults.jsx";
import HatDrawDetail from "./pages/games/HatDrawDetail.jsx";
import SecretSanta from "./pages/games/SecretSanta.jsx";
import SecretSantaDetail from "./pages/games/SecretSantaDetail.jsx";
import ChessLobby from "./pages/games/ChessLobby.jsx";
import ChessBoard from "./pages/games/ChessBoard.jsx";
import ScrabbleLobby from "./pages/games/ScrabbleLobby.jsx";
import ScrabbleBoard from "./pages/games/ScrabbleBoard.jsx";
import CoinToss from "./pages/games/CoinToss.jsx";
import RpsLobby from "./pages/games/RpsLobby.jsx";
import RpsGame from "./pages/games/RpsGame.jsx";
import RpsImportant from "./pages/games/RpsImportant.jsx";
import DiceRoll from "./pages/games/DiceRoll.jsx";
import Sudoku from "./pages/games/Sudoku.jsx";
import TetrisPractice from "./pages/games/TetrisPractice.jsx";
import TetrisTournaments from "./pages/games/TetrisTournaments.jsx";
import TetrisTournamentDetail from "./pages/games/TetrisTournamentDetail.jsx";
import PokerLobby from "./pages/games/PokerLobby.jsx";
import PokerTable from "./pages/games/PokerTable.jsx";
import StrawDraw from "./pages/games/StrawDraw.jsx";
import StrawDrawDetail from "./pages/games/StrawDrawDetail.jsx";
import Tree from "./pages/Tree.jsx";
import People from "./pages/People.jsx";
import Profile from "./pages/Profile.jsx";
import DmThread from "./pages/DmThread.jsx";
import Groups from "./pages/Groups.jsx";
import GroupThread from "./pages/GroupThread.jsx";
import Votes from "./pages/Votes.jsx";
import VoteDetail from "./pages/VoteDetail.jsx";
import Recipes from "./pages/Recipes.jsx";
import RecipeDetail from "./pages/RecipeDetail.jsx";
import ChefPage from "./pages/ChefPage.jsx";
import Wallet from "./pages/Wallet.jsx";
import Shop from "./pages/Shop.jsx";
import Marketplace from "./pages/Marketplace.jsx";
import MarketplaceDetail from "./pages/MarketplaceDetail.jsx";
import Calculator from "./pages/wallet/Calculator.jsx";
import ETransferContacts from "./pages/wallet/ETransferContacts.jsx";
import Ledgers from "./pages/wallet/Ledgers.jsx";
import LedgerDetail from "./pages/wallet/LedgerDetail.jsx";
import Debts from "./pages/wallet/Debts.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  return (
    <AuthGate>
      <TopBarActionsProvider>
      <div className="app-shell">
        <Nav />
        <div className="main-column">
          <TopBar />
          <main className="content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:eventId" element={<EventDetail />} />
              <Route path="/albums" element={<Albums />} />
              <Route path="/albums/:albumId" element={<AlbumDetail />} />
              <Route path="/games" element={<Games />} />
              <Route path="/games/spin-wheel" element={<SpinWheel />} />
              <Route path="/games/spin-results" element={<SpinResults />} />
              <Route path="/games/spin-results/:spinId" element={<SpinDetail />} />
              <Route path="/games/hat-game" element={<HatGame />} />
              <Route path="/games/hat-results" element={<HatResults />} />
              <Route path="/games/hat-results/:drawId" element={<HatDrawDetail />} />
              <Route path="/games/secret-santa" element={<SecretSanta />} />
              <Route path="/games/secret-santa/:exchangeId" element={<SecretSantaDetail />} />
              <Route path="/games/chess" element={<ChessLobby />} />
              <Route path="/games/chess/:gameId" element={<ChessBoard />} />
              <Route path="/games/scrabble" element={<ScrabbleLobby />} />
              <Route path="/games/scrabble/:gameId" element={<ScrabbleBoard />} />
              <Route path="/games/coin-toss" element={<CoinToss />} />
              <Route path="/games/rock-paper-scissors" element={<RpsLobby />} />
              <Route path="/games/rock-paper-scissors/important" element={<RpsImportant />} />
              <Route path="/games/rock-paper-scissors/:gameId" element={<RpsGame />} />
              <Route path="/games/dice-roll" element={<DiceRoll />} />
              <Route path="/games/sudoku" element={<Sudoku />} />
              <Route path="/games/tetris" element={<TetrisPractice />} />
              <Route path="/games/tetris/tournaments" element={<TetrisTournaments />} />
              <Route path="/games/tetris/tournaments/:tournamentId" element={<TetrisTournamentDetail />} />
              <Route path="/games/poker" element={<PokerLobby />} />
              <Route path="/games/poker/:tableId" element={<PokerTable />} />
              <Route path="/games/straw-draw" element={<StrawDraw />} />
              <Route path="/games/straw-draw/:gameId" element={<StrawDrawDetail />} />
              <Route path="/tree" element={<Tree />} />
              <Route path="/people" element={<People />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="/dms/:userId" element={<DmThread />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/groups/:groupId" element={<GroupThread />} />
              <Route path="/votes" element={<Votes />} />
              <Route path="/votes/:pollId" element={<VoteDetail />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/recipes/:recipeId" element={<RecipeDetail />} />
              <Route path="/recipes/chef/:chefId" element={<ChefPage />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/marketplace" element={<Marketplace />} />
              <Route path="/shop/marketplace/:listingId" element={<MarketplaceDetail />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/wallet/calculator" element={<Calculator />} />
              <Route path="/wallet/contacts" element={<ETransferContacts />} />
              <Route path="/wallet/ledgers" element={<Ledgers />} />
              <Route path="/wallet/ledgers/:ledgerId" element={<LedgerDetail />} />
              <Route path="/wallet/debts" element={<Debts />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </main>
        </div>
      </div>
      </TopBarActionsProvider>
    </AuthGate>
  );
}
