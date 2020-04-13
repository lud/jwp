defmodule JwpWeb.MainChannel do
  use JwpWeb, :channel
  require Logger

  def join("jwp:" <> scope, payload, socket) do
    with {:ok, claim_id, name} <- decode_scope(scope),
         :ok <- check_user_id(socket, claim_id),
         :ok <- check_channel(socket, name) do
      Logger.debug("joining '#{name}'")
      {:ok, socket}
    else
      err ->
        Logger.error(inspect(err))
        {:error, %{reason: "unauthorized"}}
    end
  end

  defp decode_scope(scope) do
    with [user_id_str, name] <- String.split(scope, ":"),
         {claim_id, ""} <- Integer.parse(user_id_str) do
      {:ok, claim_id, name}
    end
  end

  defp check_user_id(socket, user_id) do
    case socket.assigns.user_id do
      ^user_id -> :ok
      _ -> {:error, {:cannot_claim, user_id}}
    end
  end

  defp check_channel(socket, channel) do
    if Enum.member?(socket.assigns.allowed_channels, channel) do
      :ok
    else
      {:error, {:not_allowed, channel}}
    end
  end

  # Channels can be used in a request/response fashion
  # by sending replies to requests from the client
  def handle_in("ping", payload, socket) do
    {:reply, {:ok, payload}, socket}
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (main_channel:lobby).
  def handle_in("shout", payload, socket) do
    broadcast(socket, "shout", payload)
    {:noreply, socket}
  end

  # Add authorization logic here as required.
  defp authorized?(_payload) do
    true
  end
end
