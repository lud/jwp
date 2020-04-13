defmodule JwpWeb.Plug.ApiAuth do
  @moduledoc false
  require Logger
  use Pow.Plug.Base
  alias Plug.Conn
  alias Pow.Config

  def create(conn, user, _) do
    {conn, user}
  end

  def delete(_, _) do
    raise "called delete"
  end

  def fetch(conn, _config) do
    resp =
      with {:ok, token} <- fetch_auth_token(conn),
           {:ok, credentials} <- decode_token(token),
           {:ok, user_params} <- decode_credentials(credentials),
           {:ok, conn} <- Pow.Plug.authenticate_user(conn, user_params) do
        {conn, Pow.Plug.current_user(conn)}
      else
        error ->
          Logger.error("Invalid api auth: #{inspect(error)}")
          {conn, nil}
      end

    resp
  end

  defp fetch_auth_token(conn) do
    case Conn.get_req_header(conn, "authorization") do
      [token | _rest] -> {:ok, token}
      _any -> :error
    end
  end

  defp decode_token("Basic " <> b64),
    do: Base.decode64(b64)

  defp decode_token(_),
    do: {:error, :invalid_token}

  defp decode_credentials(bin) do
    case String.split(bin, ":") do
      [email, password] -> {:ok, %{"email" => email, "password" => password}}
      _any -> {:error, :invalid_credentials}
    end
  end
end
