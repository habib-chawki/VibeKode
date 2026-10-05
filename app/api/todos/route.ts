import { NewTodoSchema, TodoListFilterSchema } from "@todo-cat/contract";
import { parse, readJson, withUser } from "@/lib/rest";
import { addTodo, listTodos } from "@/lib/todo-service";

// GET /api/todos?status=open|done|all&q=text
export async function GET(request: Request) {
  return withUser(request, async (userId) => {
    const params = new URL(request.url).searchParams;
    const filter = parse(TodoListFilterSchema, {
      status: params.get("status") ?? undefined,
      q: params.get("q") ?? undefined,
    });
    return Response.json(await listTodos(userId, filter));
  });
}

// POST /api/todos  { title, dueDate? }
export async function POST(request: Request) {
  return withUser(request, async (userId) => {
    const input = parse(NewTodoSchema, await readJson(request));
    const todo = await addTodo(userId, input);
    return Response.json(todo, {
      status: 201,
      headers: { Location: `/api/todos/${todo.id}` },
    });
  });
}
