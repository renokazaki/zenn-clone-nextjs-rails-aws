export default async function Page() {
  const res = await fetch('http://rails:3000/api/v1/health_check')
  const data = await res.json()

  return (
    <>
      <div>Rails疎通確認</div>
      <div>レスポンスメッセージ: {data.message}</div>
    </>
  )
}