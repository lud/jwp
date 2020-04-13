# This file is responsible for configuring your application
# and its dependencies with the aid of the Mix.Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
use Mix.Config

config :jwp,
  ecto_repos: [Jwp.Repo]

# Configures the endpoint
config :jwp, JwpWeb.Endpoint,
  url: [host: "localhost"],
  secret_key_base: "7MMyu85GNk6l+IupirOS3qk99MUkfMzwVVEppjxuJGCv1gEvSOersTwMqElXOxi7",
  render_errors: [view: JwpWeb.ErrorView, accepts: ~w(json)],
  pubsub: [name: Jwp.PubSub, adapter: Phoenix.PubSub.PG2],
  live_view: [signing_salt: "kkubeq7y"]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

config :jwp, :pow,
  user: Jwp.Users.User,
  repo: Jwp.Repo

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{Mix.env()}.exs"
