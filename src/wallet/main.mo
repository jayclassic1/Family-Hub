import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Float "mo:core/Float";
import Types "../shared/Types";

persistent actor {

  type ETransferContact = Types.ETransferContact;
  type Ledger = Types.Ledger;
  type Expense = Types.Expense;
  type Balance = Types.Balance;
  type Debt = Types.Debt;
  type UserProfilePublic = Types.UserProfilePublic;

  type AuthActor = actor {
    getUser : shared query (Principal) -> async ?UserProfilePublic;
  };

  let contacts = Map.empty<Principal, [ETransferContact]>();
  var contactCounter : Nat = 0;

  let ledgers = Map.empty<Nat, Ledger>();
  var ledgerCounter : Nat = 0;

  let expenses = Map.empty<Nat, Expense>();
  var expenseCounter : Nat = 0;

  let debts = Map.empty<Principal, [Debt]>();
  var debtCounter : Nat = 0;

  // Private "Love" currency balance, earned through engagement.
  let loveBalances = Map.empty<Principal, Nat>();

  func loveBalanceOf(p : Principal) : Nat {
    switch (Map.get(loveBalances, Principal.compare, p)) {
      case (?b) { b };
      case null { 100 };
    }
  };

  func authUsername(caller : Principal) : async Text {
    let authIdOpt = Runtime.envVar("PUBLIC_CANISTER_ID:auth");
    let authId = switch (authIdOpt) {
      case (?id) { id };
      case null { Runtime.trap("auth canister id not configured") };
    };
    let authCanister : AuthActor = actor (authId);
    let profile = await authCanister.getUser(caller);
    switch (profile) {
      case (?p) { p.username };
      case null { "Unknown" };
    }
  };

  func isParticipant(l : Ledger, p : Principal) : Bool {
    switch (Array.find<Principal>(l.participants, func(x : Principal) : Bool { Principal.equal(x, p) })) {
      case (?_) { true };
      case null { false };
    }
  };

  public shared ({ caller }) func addContact(name : Text, email : Text) : async Nat {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Not signed in") };
    let existing = switch (Map.get(contacts, Principal.compare, caller)) {
      case (?c) { c };
      case null { [] };
    };
    let id = contactCounter;
    let newContact : ETransferContact = { id; name; email };
    Map.add(contacts, Principal.compare, caller, Array.concat<ETransferContact>(existing, [newContact]));
    contactCounter += 1;
    id
  };

  func isCallerAdmin(caller : Principal) : async Bool {
    switch (Runtime.envVar("PUBLIC_CANISTER_ID:auth")) {
      case (?authId) {
        let authCanister : AuthActor = actor (authId);
        switch (await authCanister.getUser(caller)) {
          case (?p) {
            switch (p.role) {
              case (#admin) { true };
              case (#member) { false };
            };
          };
          case null { false };
        };
      };
      case null { false };
    };
  };

  public shared ({ caller }) func removeContact(contactId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(contacts, Principal.compare, caller)) {
      case (?c) {
        let filtered = Array.filter<ETransferContact>(c, func(x : ETransferContact) : Bool { x.id != contactId });
        Map.add(contacts, Principal.compare, caller, filtered);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func adminRemoveContact(target : Principal, contactId : Nat) : async Bool {
    if (not (await isCallerAdmin(caller))) { return false };
    switch (Map.get(contacts, Principal.compare, target)) {
      case (?c) {
        let filtered = Array.filter<ETransferContact>(c, func(x : ETransferContact) : Bool { x.id != contactId });
        Map.add(contacts, Principal.compare, target, filtered);
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func listContacts() : async [ETransferContact] {
    switch (Map.get(contacts, Principal.compare, caller)) {
      case (?c) { c };
      case null { [] };
    }
  };

  public shared ({ caller }) func addDebt(
    description : Text,
    counterparty : Text,
    amount : Float,
    isOwedByMe : Bool
  ) : async Nat {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Not signed in") };
    let existing = switch (Map.get(debts, Principal.compare, caller)) {
      case (?d) { d };
      case null { [] };
    };
    let id = debtCounter;
    let newDebt : Debt = {
      id;
      description;
      counterparty;
      amount;
      isOwedByMe;
      isPaid = false;
      created = Time.now();
    };
    Map.add(debts, Principal.compare, caller, Array.concat<Debt>(existing, [newDebt]));
    debtCounter += 1;
    id
  };

  public shared ({ caller }) func toggleDebtPaid(debtId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(debts, Principal.compare, caller)) {
      case (?d) {
        var found = false;
        let updated = Array.map<Debt, Debt>(
          d,
          func(x : Debt) : Debt {
            if (x.id == debtId) {
              found := true;
              { x with isPaid = not x.isPaid };
            } else { x };
          }
        );
        if (found) {
          Map.add(debts, Principal.compare, caller, updated);
        };
        found
      };
      case null { false };
    }
  };

  public shared ({ caller }) func removeDebt(debtId : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    switch (Map.get(debts, Principal.compare, caller)) {
      case (?d) {
        let filtered = Array.filter<Debt>(d, func(x : Debt) : Bool { x.id != debtId });
        Map.add(debts, Principal.compare, caller, filtered);
        true
      };
      case null { false };
    }
  };

  public shared ({ caller }) func adminRemoveDebt(target : Principal, debtId : Nat) : async Bool {
    if (not (await isCallerAdmin(caller))) { return false };
    switch (Map.get(debts, Principal.compare, target)) {
      case (?d) {
        let filtered = Array.filter<Debt>(d, func(x : Debt) : Bool { x.id != debtId });
        Map.add(debts, Principal.compare, target, filtered);
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func listDebts() : async [Debt] {
    switch (Map.get(debts, Principal.compare, caller)) {
      case (?d) { d };
      case null { [] };
    }
  };

  // Callable by any signed-in caller to credit THEMSELVES Love for a
  // legitimate engagement action that already succeeded elsewhere
  // (photo liked, recipe rated, voted, event RSVP, etc).
  // Credits a SPECIFIC other person's balance — used when someone else's
  // engagement earns Love for the target (e.g. an event creator earning
  // Love because someone RSVP'd yes).
  public shared ({ caller }) func earnLoveFor(target : Principal, amount : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    if (amount == 0) { return false };
    let current = loveBalanceOf(target);
    Map.add(loveBalances, Principal.compare, target, current + amount);
    true
  };

  public shared ({ caller }) func spendLove(amount : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let current = loveBalanceOf(caller);
    if (current < amount) { return false };
    Map.add(loveBalances, Principal.compare, caller, current - amount);
    true
  };

  // Deducts from a SPECIFIC other person's balance — used when another
  // canister needs to charge a cost on behalf of the original caller
  // (e.g. the 3 Love cost of creating a poll, charged from the votes
  // canister on behalf of the poll creator).
  public shared ({ caller }) func spendLoveFor(target : Principal, amount : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    let current = loveBalanceOf(target);
    if (current < amount) { return false };
    Map.add(loveBalances, Principal.compare, target, current - amount);
    true
  };

  // Sends Love directly from the caller to another person (e.g. "loving"
  // something they posted). Fails cleanly if the caller can't afford it.
  public shared ({ caller }) func transferLove(target : Principal, amount : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    if (Principal.equal(caller, target)) { return false };
    if (amount == 0) { return false };
    let senderBalance = loveBalanceOf(caller);
    if (senderBalance < amount) { return false };
    Map.add(loveBalances, Principal.compare, caller, senderBalance - amount);
    let recipientBalance = loveBalanceOf(target);
    Map.add(loveBalances, Principal.compare, target, recipientBalance + amount);
    true
  };

  // Same as transferLove, but for use by another trusted canister acting
  // on behalf of a specific giver/receiver pair (e.g. a content canister
  // handling a "love this post" button, where the real giver isn't the
  // caller of THIS canister).
  public shared ({ caller }) func transferLoveBetween(giver : Principal, receiver : Principal, amount : Nat) : async Bool {
    if (Principal.isAnonymous(caller)) { return false };
    if (Principal.equal(giver, receiver)) { return false };
    if (amount == 0) { return false };
    let giverBalance = loveBalanceOf(giver);
    if (giverBalance < amount) { return false };
    Map.add(loveBalances, Principal.compare, giver, giverBalance - amount);
    let receiverBalance = loveBalanceOf(receiver);
    Map.add(loveBalances, Principal.compare, receiver, receiverBalance + amount);
    true
  };

  public query ({ caller }) func getMyLove() : async Nat {
    loveBalanceOf(caller)
  };

  public shared ({ caller }) func createLedger(name : Text, description : Text, otherParticipants : [Principal]) : async Nat {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Not signed in") };
    let creatorName = await authUsername(caller);
    let allParticipants = Array.concat<Principal>([caller], otherParticipants);
    let id = ledgerCounter;
    let l : Ledger = {
      id;
      name;
      description;
      creator = caller;
      creatorName;
      participants = allParticipants;
      created = Time.now();
    };
    Map.add(ledgers, Nat.compare, id, l);
    ledgerCounter += 1;
    id
  };

  public shared ({ caller }) func addParticipant(ledgerId : Nat, newParticipant : Principal) : async Bool {
    switch (Map.get(ledgers, Nat.compare, ledgerId)) {
      case (?l) {
        if (not Principal.equal(l.creator, caller)) { return false };
        let already = isParticipant(l, newParticipant);
        if (already) { return true };
        let updated = { l with participants = Array.concat<Principal>(l.participants, [newParticipant]) };
        Map.add(ledgers, Nat.compare, ledgerId, updated);
        true
      };
      case null { false };
    }
  };

  public query ({ caller }) func listMyLedgers() : async [Ledger] {
    Array.filter<Ledger>(
      Array.fromIter<Ledger>(Map.values(ledgers)),
      func(l : Ledger) : Bool { isParticipant(l, caller) }
    )
  };

  public query ({ caller }) func getLedger(ledgerId : Nat) : async ?Ledger {
    switch (Map.get(ledgers, Nat.compare, ledgerId)) {
      case (?l) { if (isParticipant(l, caller)) { ?l } else { null } };
      case null { null };
    }
  };

  public shared ({ caller }) func addExpense(
    ledgerId : Nat,
    description : Text,
    amount : Float,
    paidBy : Principal,
    splitAmong : [Principal]
  ) : async Nat {
    switch (Map.get(ledgers, Nat.compare, ledgerId)) {
      case (?l) {
        if (not isParticipant(l, caller)) {
          Runtime.trap("Only ledger participants can add expenses");
        };
        if (splitAmong.size() == 0) {
          Runtime.trap("Must split among at least one person");
        };
      };
      case null { Runtime.trap("Ledger not found") };
    };
    let paidByName = await authUsername(paidBy);
    let id = expenseCounter;
    let e : Expense = {
      id;
      ledgerId;
      description;
      amount;
      paidBy;
      paidByName;
      splitAmong;
      created = Time.now();
    };
    Map.add(expenses, Nat.compare, id, e);
    expenseCounter += 1;
    id
  };

  public shared ({ caller }) func deleteExpense(expenseId : Nat) : async Bool {
    switch (Map.get(expenses, Nat.compare, expenseId)) {
      case (?e) {
        switch (Map.get(ledgers, Nat.compare, e.ledgerId)) {
          case (?l) {
            if (not (Principal.equal(l.creator, caller) or Principal.equal(e.paidBy, caller))) {
              if (not (await isCallerAdmin(caller))) { return false };
            };
            ignore Map.remove(expenses, Nat.compare, expenseId);
            true
          };
          case null { false };
        }
      };
      case null { false };
    }
  };

  public query ({ caller }) func getExpenses(ledgerId : Nat) : async [Expense] {
    switch (Map.get(ledgers, Nat.compare, ledgerId)) {
      case (?l) {
        if (not isParticipant(l, caller)) { return [] };
      };
      case null { return [] };
    };
    Array.filter<Expense>(
      Array.fromIter<Expense>(Map.values(expenses)),
      func(e : Expense) : Bool { e.ledgerId == ledgerId }
    )
  };

  public query ({ caller }) func getBalances(ledgerId : Nat) : async [Balance] {
    switch (Map.get(ledgers, Nat.compare, ledgerId)) {
      case (?l) {
        if (not isParticipant(l, caller)) { return [] };
        let ledgerExpenses = Array.filter<Expense>(
          Array.fromIter<Expense>(Map.values(expenses)),
          func(e : Expense) : Bool { e.ledgerId == ledgerId }
        );
        Array.map<Principal, Balance>(
          l.participants,
          func(p : Principal) : Balance {
            var net : Float = 0.0;
            for (e in ledgerExpenses.vals()) {
              if (Principal.equal(e.paidBy, p)) {
                net += e.amount;
              };
              let inSplit = switch (Array.find<Principal>(e.splitAmong, func(x : Principal) : Bool { Principal.equal(x, p) })) {
                case (?_) { true };
                case null { false };
              };
              if (inSplit) {
                net -= e.amount / Float.fromInt(e.splitAmong.size());
              };
            };
            { user = p; netAmount = net };
          }
        )
      };
      case null { [] };
    }
  };
};
