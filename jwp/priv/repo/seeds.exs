# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     Jwp.Repo.insert!(%Jwp.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.

Jwp.Users.create(%{
  email: "dev@dev.dev",
  password: "$dev2020",
  password_confirmation: "$dev2020"
})
