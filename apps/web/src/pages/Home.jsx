import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function Home() {
  const [hotels, setHotels] = useState([])
  useEffect(() => {
    fetch('/api/hotels').then(r => r.json()).then(j => { if (j && j.data) setHotels(j.data) }).catch(() => {})
  }, [])
  return (
    <div>
      <h1>酒店列表</h1>
      <ul>
        {hotels.map(h => (
          <li key={h.id} style={{marginBottom:8}}>
            <Link to={`/hotels/${h.id}`}>{h.name || `酒店 ${h.id}`}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
