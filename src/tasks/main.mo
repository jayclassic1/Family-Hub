import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Types "../shared/Types";

persistent actor {

  type FamilyTask = Types.FamilyTask;
  type FamilyTaskPublic = Types.FamilyTaskPublic;

  let tasks = Map.empty<Nat, FamilyTask>();
  var taskCounter : Nat = 0;

  public shared ({ caller }) func createTask(title : Text, assignedTo : Principal, dueDate : ?Int) : async Nat {
    let id = taskCounter;
    let task : FamilyTask = {
      id;
      title;
      var completed = false;
      assignedTo;
      creator = caller;
      dueDate;
    };
    Map.add(tasks, Nat.compare, id, task);
    taskCounter += 1;
    id
  };

  public shared ({ caller }) func completeTask(taskId : Nat) : async Bool {
    switch (Map.get(tasks, Nat.compare, taskId)) {
      case (?task) {
        task.completed := true;
        true
      };
      case null { false };
    }
  };

  public query func getAllTasks() : async [FamilyTaskPublic] {
    Array.map<FamilyTask, FamilyTaskPublic>(
      Array.fromIter<FamilyTask>(Map.values(tasks)),
      func(t : FamilyTask) : FamilyTaskPublic {
        {
          id = t.id;
          title = t.title;
          completed = t.completed;
          assignedTo = t.assignedTo;
          creator = t.creator;
          dueDate = t.dueDate;
        }
      }
    )
  };

  public query func getIncompleteTasks() : async [FamilyTaskPublic] {
    Array.map<FamilyTask, FamilyTaskPublic>(
      Array.filter<FamilyTask>(
        Array.fromIter<FamilyTask>(Map.values(tasks)),
        func(t : FamilyTask) : Bool { not t.completed }
      ),
      func(t : FamilyTask) : FamilyTaskPublic {
        {
          id = t.id;
          title = t.title;
          completed = t.completed;
          assignedTo = t.assignedTo;
          creator = t.creator;
          dueDate = t.dueDate;
        }
      }
    )
  };
};
