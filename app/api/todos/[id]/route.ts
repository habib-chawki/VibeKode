import { TodoUpdateSchema } from "@todo-cat/contract";
import { parse, readJson, withUser } from "@/lib/rest";
import { deleteTodo, getTodo, updateTodo } from "@/lib/todo-service";

type Context = RouteContext<"/api/todos/[id]">;

// GET /api/todos/:id
export async function GET(request: Request, ctx: Context) {
  return withUser(request, async (userId) => {
    const { id } = await ctx.params;
    return Response.json(await getTodo(userId, id));
  });
}

// PATCH /api/todos/:id  { title?, dueDate? (null clears), done? }
export async function PATCH(request: Request, ctx: Context) {
  return withUser(request, async (userId) => {
    const { id } = await ctx.params;
    const patch = parse(TodoUpdateSchema, await readJson(request));
    return Response.json(await updateTodo(userId, id, patch));
  });
}

// DELETE /api/todos/:id
export async function DELETE(request: Request, ctx: Context) {
  return withUser(request, async (userId) => {
    const { id } = await ctx.params;
    await deleteTodo(userId, id);
    return new Response(null, { status: 204 });
  });
}
