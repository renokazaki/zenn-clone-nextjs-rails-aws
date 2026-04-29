import { Button } from '@mui/material'

export default function HelloMui() {
  return (
    <>
      <Button variant="contained">Hello MUI v6!</Button>
      <Button variant="outlined" sx={{ ml: 2 }}>
        Outlined
      </Button>
    </>
  )
}
