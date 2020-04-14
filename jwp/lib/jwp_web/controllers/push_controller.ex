defmodule JwpWeb.PushController do
  use JwpWeb, :controller
  require Logger
  import Jwp.History, only: [register_message: 3]

  def push_message(conn, %{"channel" => channel, "event" => event, "payload" => payload}) do
    %{id: user_id} = Pow.Plug.current_user(conn)

    channel = "jwp:#{user_id}:#{channel}"

    with {:ok, {^event, payload2}} <- register_message(channel, event, payload),
         :ok <- JwpWeb.Endpoint.broadcast!(channel, event, payload2) do
      conn
      |> put_status(201)
      |> json(%{status: "ok"})
    else
      err ->
        Logger.error(inspect(err))

        conn
        |> put_status(500)
        |> json(%{status: "error"})
    end
  end

  def push_message(conn, _) do
    conn
    |> put_status(400)
    |> json(%{status: "error", error: "Missing data"})
  end
end
