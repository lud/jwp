defmodule JwpWeb.MainChannel do
  use JwpWeb, :channel
  require Logger

  def join("jwp:" <> scope = channel, payload, socket) do
    IO.inspect(payload, label: "payload")

    with {:ok, claim_id, name} <- decode_scope(scope),
         :ok <- check_user_id(socket, claim_id),
         :ok <- check_channel(socket, name) do
      Logger.debug("joining '#{name}'")
      # history will send messages to this channel process from a Task
      maybe_poll_history(channel, payload)
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

  # when is_map(tid) 
  defp maybe_poll_history(channel, %{"last_message_id" => nil}),
    do: :ok

  defp maybe_poll_history(channel, %{"last_message_id" => tid}) do
    this = self()

    # @todo link task to channel process ?
    Task.Supervisor.start_child(Jwp.TaskSup, fn ->
      messages =
        Jwp.History.get_messages_after(channel, tid)
        |> Enum.each(fn {event, payload} ->
          send(this, {:history_message, event, payload})
        end)
    end)
  end

  defp maybe_poll_history(_, _),
    do: :ignore

  def handle_info({:history_message, event, payload}, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  def handle_info(msg, socket) do
    Logger.warn("Unhandled info in #{__MODULE__}: #{inspect(msg)}")
    {:noreply, socket}
  end
end
