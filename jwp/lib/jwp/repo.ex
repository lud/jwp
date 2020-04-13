defmodule Jwp.Repo do
  use Ecto.Repo,
    otp_app: :jwp,
    adapter: Ecto.Adapters.Postgres
end
