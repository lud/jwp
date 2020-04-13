defmodule JwpWeb.PushController do
  use JwpWeb, :controller

  def push_message(conn, %{"channel" => channel, "event" => event, "payload" => payload}) do
    %{id: user_id} = Pow.Plug.current_user(conn)

    channel = "jwp:#{user_id}:#{channel}"

    JwpWeb.Endpoint.broadcast!(channel, event, payload)

    conn
    |> put_status(201)
    |> json(%{status: "ok"})
  end

  def push_message(conn, _) do
    conn
    |> put_status(400)
    |> json(%{status: "error", error: "Missing data"})
  end
end
