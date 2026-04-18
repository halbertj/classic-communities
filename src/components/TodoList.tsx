import { cn } from "@/lib/utils";

type Todo = {
  id: string;
  title: string;
  is_complete: boolean;
  inserted_at: string;
};

type TodoListProps = {
  todos: Todo[];
};

export function TodoList({ todos }: TodoListProps) {
  if (todos.length === 0) {
    return (
      <p className="text-sm text-muted">
        No todos yet. Insert a row in the Supabase dashboard to see it
        show up here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {todos.map((todo) => (
        <li
          key={todo.id}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <span
            className={cn(
              "text-sm",
              todo.is_complete && "line-through text-muted",
            )}
          >
            {todo.title}
          </span>
          <span className="text-xs text-muted">
            {new Date(todo.inserted_at).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
