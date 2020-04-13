defmodule Jwp.Users do
  use Pow.Ecto.Context,
    repo: Jwp.Repo,
    user: Jwp.Users.User

  def create(params) do
    pow_create(params)
  end
end
