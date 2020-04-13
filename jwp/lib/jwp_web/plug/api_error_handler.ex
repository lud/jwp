defmodule JwpWeb.ApiErrorHandler do
  use JwpWeb, :controller
  alias Plug.Conn

  @spec call(Conn.t(), :not_authenticated) :: Conn.t()
  def call(conn, :not_authenticated) do
    conn
    |> put_status(401)
    |> json(%{status: "error", error: %{code: 401, message: "Not authenticated"}})
  end
end
