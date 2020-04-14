defmodule Jwp.History do
  use GenServer, restart: :transient
  import Ex2ms
  require Logger

  require Record
  # The state record
  Record.defrecordp(:s, tab: nil, msg_id: nil)

  @registry Jwp.History.Registry
  @sup Jwp.History.Sup
  @purge_delay 30 * 1000
  @msg_ttl 60 * 1000

  @todo """
  We shutdown on timeout (if table is empty), so if a call is made
  while we are terminating but not unregistered, the call will fail.

  We should then try/rescue and retry the calls in the push
  controller, and make the polling tasks transient.
  """

  def via(channel) when is_binary(channel),
    do: {:via, Registry, {@registry, channel}}

  def get_pid!(channel) do
    case Registry.lookup(@registry, channel) do
      [] ->
        {:ok, pid} = boot(channel)
        pid

      [{pid, _}] ->
        pid
    end
  end

  defp boot(channel) do
    DynamicSupervisor.start_child(@sup, {__MODULE__, channel: channel})
  end

  def start_link([{:channel, channel}]) do
    GenServer.start_link(__MODULE__, [channel], name: via(channel))
  end

  def register_message(channel, event, payload) do
    GenServer.call(get_pid!(channel), {:register_message, event, payload})
  end

  def get_table(channel) do
    {:ok, tab} = GenServer.call(get_pid!(channel), :get_table)
  end

  def get_messages_after(channel, %{"time" => time, "id" => id} = tid) do
    {:ok, tab} = get_table(channel)
    last_key = {time, id}

    match_spec =
      fun do
        {key, event, message} when key > ^last_key -> {event, message}
      end

    :ets.select(tab, match_spec)
  end

  @impl true
  def init([channel]) do
    tab = :ets.new(__MODULE__, [:ordered_set, :protected, {:read_concurrency, true}])
    schedule_purge()
    {:ok, s(tab: tab, msg_id: 1)}
  end

  @impl true
  def handle_call(:get_table, _from, s(tab: tab) = state) do
    {:reply, {:ok, tab}, state}
  end

  def handle_call({:register_message, event, payload}, _from, state) do
    s(tab: tab, msg_id: id) = state
    time = :erlang.monotonic_time(:millisecond)

    # We do not use :erlang.unique_integer([:monotonic]) because
    # javascript cannot handle such big integers, and even with
    # :positive we can have the same ids for different channels
    # id = :erlang.unique_integer([:monotonic, :positive])

    key = {time, id}

    # We store the key in the message data in order to receive it from the client and match newer messages
    payload2 = %{tid: %{"time" => time, "id" => id}, data: payload}

    record = {key, event, payload2}
    true = :ets.insert(tab, record)
    {:reply, {:ok, {event, payload2}}, state}
  end

  @impl true
  def handle_info(:purge, s(tab: tab) = state) do
    schedule_purge()
    purge_messages(tab)
    # we set a timeout of 0 so we have a chance to shutdown after
    # every purge.
    {:noreply, state, 0}
  end

  def handle_info(:timeout, s(tab: tab) = state) do
    # @todo cancel purge timer ?
    case :ets.info(tab, :size) do
      0 -> {:stop, :normal, state}
      data -> {:noreply, state}
    end
  end

  def handle_info(msg, state) do
    Logger.warn("Unhandled info in #{__MODULE__}: #{inspect(msg)}")
    {:noreply, state}
  end

  defp schedule_purge() do
    :erlang.send_after(@purge_delay, self(), :purge)
  end

  defp purge_messages(tab) do
    now = :erlang.monotonic_time(:millisecond)
    min_keep = {now - @msg_ttl, 0}

    match_spec =
      fun do
        {key, event, message} when key < ^min_keep -> true
      end

    count = :ets.select_delete(tab, match_spec)
    # Logger.debug("Deleted #{count} entries from table")
    :ok
  end
end
