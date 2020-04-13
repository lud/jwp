defmodule JwpWeb.TokenController do
  use JwpWeb, :controller

  def auth_socket(conn, params) do
    %{id: user_id} = Pow.Plug.current_user(conn)
    params |> IO.inspect()

    channels =
      Map.get(params, "channels", [])
      |> IO.inspect()

    token = JwpWeb.PubSubSocket.create_token(user_id, channels)

    json(conn, %{
      "status" => "ok",
      "data" => %{
        "user_id" => user_id,
        "token" => token
      }
    })
  end
end
